const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrabentertainmentmel = onRequest({"region":"us-east4"}, (req, res) => server.then(it => it.handle(req, res)));
  