const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');

const directory = process.env.GITHUB_WORKSPACE
const eventPath = process.env.GITHUB_EVENT_PATH
const header = core.getInput('header');
const file = core.getInput('file');
const lerna = core.getInput('lerna');
var changed = false;
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
  const headSha = eventData.pull_request.head.sha;
  const baseSha = eventData.pull_request.base.sha;
  const gitChangedFiles = (await execAndReturnOutput(`git --no-pager diff --name-only ${headSha}..${baseSha} -- *${file}`)).trim().split("\n");

  if(lerna) {
    const lernaPackages = JSON.parse(await execAndReturnOutput(`npx lerna changed --json --loglevel silent`));
    var errors = "";
    var changedLocal = false;
    var headerFoundLocal = false;
    for (const package of lernaPackages) {
      const fileLocation = package.location;
      for (const filename of gitChangedFiles) {
        if (filename.includes(fileLocation + "/" + file)) {
          changedLocal = true;
          var contents = fs.readFileSync(fileLocation + "/" + object.filename);
          if (contents.includes(header)) {
            headerFoundLocal = true;
          }
        }
      }

      if (changedLocal == true) {
        changed == true;

        if (headerFoundLocal == true && headerFound != false) {
          headerFound == true;
        } else if (headerFoundLocal == false) {
          headerFound == false;
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
        var contents = fs.readFileSync(directory + "/" + object.filename);
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
