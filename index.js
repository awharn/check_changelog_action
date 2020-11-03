const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

const directory = process.env.GITHUB_WORKSPACE
const eventPath = process.env.GITHUB_EVENT_PATH
const header = core.getInput('header');
const file = core.getInput('file');
const lerna = (core.getInput('lerna').toLowerCase() === "true");

console.log("Lerna Input: " + core.getInput('lerna').toLowerCase());
console.log("Lerna interpretation: " + lerna);

var changed = undefined;
var headerFound = undefined;

async function execAndReturnOutput(command) {
  let capturedOutput = "";
  const options = {
    listeners: {
      stdout: (data) => {
        capturedOutput += data.toString();
      }
    }
  }
  await exec.exec(command, undefined, options);
  return capturedOutput;
}

async function checkChangelog() {
  const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
  const baseRef = eventData.pull_request.base.ref;
  const gitChangedFiles = (await execAndReturnOutput(`git --no-pager diff origin/${baseRef} --name-only`)).trim().split("\n");

  if(lerna) {
    const lernaPackages = JSON.parse(await execAndReturnOutput(`npx lerna changed --json --loglevel silent`));
    var errors = "";
    var changedLocal = false;
    var headerFoundLocal = false;
    for (const package of lernaPackages) {
      const fileLocation = path.relative(directory, package.location);
      for (const filename of gitChangedFiles) {
        if (filename.includes(fileLocation + "/" + file)) {
          console.log(filename);
          changedLocal = true;
          var contents = fs.readFileSync(directory + "/" + filename);
          headerFoundLocal = contents.includes(header);
        }
      }

      if (changedLocal == true) {
        if (changed == null || changed == true) {
          changed = true;
        }

        if (headerFoundLocal == true && headerFound != false) {
          headerFound = true;
        } else if (headerFoundLocal == false) {
          headerFound = false;
          errors = errors + `The changelog has changed in ${fileLocation}, but the required header is missing.\n`;
        }
      } else if (changedLocal == false) {
        errors = errors + `The changelog was not changed in this pull request for ${fileLocation}.\n`;
      }
    }
    headerFound = headerFound || false;

    core.setOutput('changed', changed.toString());
    core.setOutput('header', headerFound.toString());

    if (changed == false || headerFound == false) {
      const err = new Error(errors);
      err.stack = "";
      throw err;
    }

  } else {
    for (const filename of gitChangedFiles) {
      if (filename.includes(file)) {
        changed = true;
        var contents = fs.readFileSync(directory + "/" + filename);
        headerFound = contents.includes(header);
      }
    }
    headerFound = headerFound || false;

    core.setOutput('changed', changed.toString());
    core.setOutput('header', headerFound.toString());

    if (changed == false) {
      const err = new Error("The changelog was not changed in this pull request.");
      err.stack = "";
      throw err;
    } else if (headerFound == false) {
      const err = new Error("The changelog has changed, but the required header is missing.");
      err.stack = "";
      throw err;
    }
  }
}

checkChangelog().catch((error) => {
  core.setFailed(error.message);
});
