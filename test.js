const HttpsService = require('./https-service');

const service = new HttpsService('httpbin.org');

service
  .get('/get')
  .then(response => {
    console.log(JSON.stringify(response, null, 2));
  })
  .catch(err => {
    console.error(JSON.stringify(err, null, 2));
  });
