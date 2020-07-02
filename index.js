const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const request = require('request');

const header = core.getInput('header');
const file = core.getInput('file');
const token = core.getInput('token');

var changed = false;
var headerFound = false;
var json;
var bodyString;
var files = [];

function callback(error, response, body) {
  bodyString = error;
  bodyString = bodyString + " Body: " + body;
  bodyString = bodyString + " Response: " + response;
  json = JSON.parse(body);
  console.log(json);

  for (item in JSON.parse(body)) {
    var object = json[item];
    files.push(object.filename);
    console.log(object);
    if (object.filename.toString().includes(file)) {
      changed = true;
      var contents = fs.readFileSync(object.filename);
      if (contents.includes(header)) {
        headerFound = true;
      }
    }
  }
}

try {
  const reqUrl = `https://api.github.com/repos/${github.context.payload.repository.full_name}/pulls/${github.context.payload.pull_request.number}/files`;

  console.log(reqUrl);

  const reqOptions = {
    url: reqUrl,
    method: 'GET',
    headers: {
      'User-Agent': 'Check-Changelog-Action',
      'Authorization': `Bearer ${token}`
    }
  };

  request(reqOptions, callback);

  console.log(`Files: ${files}; Changelog found: ${changed}; Header found: ${headerFound}; Json: ${JSON.stringify(json)}; Body: ${bodyString}`);

  core.setOutput('changed', changed.toString());
  core.setOutput('header', headerFound.toString());

} catch (error) {
  core.setFailed(error.message);
}
