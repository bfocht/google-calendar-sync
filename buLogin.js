const cheerio = require('cheerio');

const https = require('https');

const LoginUrl = 'learn.bu.edu';
const SSOUrl = 'shib.bu.edu';

const request = (hostname, path, method, headers, body, callback) => {
  const options = {
    hostname,
    path,
    method,
    headers
  };

  if (body) {
    options.headers['Content-Length'] = Buffer.byteLength(body);
  }

  const req = https.request(options, webResponse => {
    let responseString = '',
      responseObject = {};
    webResponse.setEncoding('utf-8');

    webResponse.on('data', data => {
      responseString += data;
    });

    webResponse.on('end', () => {
      try {
        responseObject = { message: responseString, webResponse };
      } catch (e) {
        return callback(e);
      }

      return callback(null, responseObject);
    });
  });

  req.on('error', (error) => {
    return callback(error, {});
  });

  if (body) {
    req.write(body);
  }

  req.end();
};

const processCookies = (response => {
  return response.headers['set-cookie'].map(item => {
    return item.split(';')[0];
  }).join(';');
});


const combineCookies = (cookie1, cookie2) => {
  cookie1 = cookie1.split(';');
  cookie2 = cookie2.split(';');

  cookie1 = cookie1.filter(item => {
    return !item.startsWith('BbRouter') && !item.startsWith('JSESSIONID')
  });

  cookie2 = cookie2.concat(cookie1);
  return cookie2.join(';');
}

const login = (loginName, password, callback ) => {
  if (!loginName || !password) return callback('empty login');

  loginName = encodeURIComponent(loginName);
  password = encodeURIComponent(password);

  request(LoginUrl, '', 'GET', {}, null, (err, loginResponse) => {
    if (loginResponse.webResponse.statusCode != 302) {
      return callback('unknown response');
    }

    const loginCookie1 = processCookies(loginResponse.webResponse);
    const location = loginResponse.webResponse.headers.location;

    request(LoginUrl, location, 'GET', {cookie: loginCookie1}, null, (err, loginResponse) => {

      const loginCookie2 = processCookies(loginResponse.webResponse);

      const pageContent = cheerio.load(loginResponse.message);

      const key = encodeURIComponent(pageContent('input')[0].attribs.name);
      const value = encodeURIComponent(pageContent('input')[0].attribs.value);

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://learn.bu.edu/auth-saml/saml/login'
      };
      const body = `${key}=${value}`;

      console.log('Getting sso Page...');
      request(SSOUrl, '/idp/profile/SAML2/POST/SSO', 'POST', headers, body, (err, ssoResponse) => {
        cookie = processCookies(ssoResponse.webResponse);
        const location = ssoResponse.webResponse.headers.location.replace('https://shib.bu.edu','');

        request(SSOUrl, location, 'GET', {Cookie: cookie}, null, (err, ssoResponseGet) => {
          const body = `j_username=${loginName}&j_password=${password}&_eventId_proceed=`;

          const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
          };

          console.log('Logging In....');
          request(SSOUrl, '/idp/profile/SAML2/POST/SSO?execution=e1s1', 'POST', headers, body, (err, samlResponse) => {
            if (samlResponse.webResponse.statusCode != 200) {
              return callback('Unexpected response');
            }

            const samlRedirctPage = cheerio.load(samlResponse.message);

            const key = encodeURIComponent(samlRedirctPage('input')[0].attribs.name);
            const value = encodeURIComponent(samlRedirctPage('input')[0].attribs.value);

            const formAction = samlRedirctPage('form')[0].attribs.action;
            const location = formAction.replace('https://learn.bu.edu', '');

            const loginCookie = combineCookies(loginCookie1, loginCookie2);
            const body = `${key}=${value}`;
            const headers = {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': loginCookie,
            };
            console.log('Posting response SAML....');
            request(LoginUrl, location, 'POST', headers, body, (err, authResponse) => {
              console.log('Logged in...');
              const cookie = processCookies(authResponse.webResponse);
              const finalCookie = combineCookies(loginCookie, cookie);
              return callback(null, finalCookie);
            });
          });
        });
      });
    });
  });
};

module.exports = {
  login
}
