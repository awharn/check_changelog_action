const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const request = require('request');

const directory = process.env.GITHUB_WORKSPACE
const header = core.getInput('header');
const file = core.getInput('file');
const token = core.getInput('token');

var changed = false;
var headerFound = false;
var json;

function callback(error, response, body) {
  json = JSON.parse(body);

  for (item in JSON.parse(body)) {
    var object = json[item];
    if (object.filename.toString().includes(file)) {
      changed = true;
      var contents = fs.readFileSync(directory + "/" + object.filename);
      if (contents.includes(header)) {
        headerFound = true;
      }
    }
  }

  return;
}

try {
  const reqUrl = `https://api.github.com/repos/${github.context.payload.repository.full_name}/pulls/${github.context.payload.pull_request.number}/files`;

  const reqOptions = {
    url: reqUrl,
    method: 'GET',
    headers: {
      'User-Agent': 'Check-Changelog-Action',
      'Authorization': `Bearer ${token}`
    }
  };

  request(reqOptions, callback);

  core.setOutput('changed', changed.toString());
  core.setOutput('header', headerFound.toString());

  if (changed == false) {
    throw new Error("The changelog was not changed in this pull request.");
  } else if (headerFound == false) {
    throw new Error("The changelog has changed, but the required header is missing.");
  }

} catch (error) {
  core.setFailed(error.message);
}
