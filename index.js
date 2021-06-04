const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

const directory = process.env.GITHUB_WORKSPACE
const eventPath = process.env.GITHUB_EVENT_PATH
const header = core.getInput('header');
const file = core.getInput('file');
const ignoreFiles = core.getInput('ignoreFiles');
const lerna = (core.getInput('lerna').toLowerCase() === "true");

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
    let lernaPackages = JSON.parse(await execAndReturnOutput(`npx lerna list --since origin/${baseRef} --exclude-dependents --json --loglevel silent`));
    var errors = "";
    for (const package of lernaPackages) {
      const resolvedPkgDir = path.join(path.relative(directory, package.location));
      let modifiedFiles = await execAndReturnOutput(`git diff --name-only origin/${baseRef}..HEAD -- ${resolvedPkgDir} | grep -Ev '${ignoreFiles}'`);
      if (modifiedFiles.length <= 1) {
        lernaPackages = lernaPackages.filter(packages => packages.name != package.name);
      }
    }

    for (const package of lernaPackages) {
      const changelogLocation = path.join(path.relative(directory, package.location), file);
      let changedLocal = false;
      let headerFoundLocal = false;
      for (const filename of gitChangedFiles) {
        if (filename == changelogLocation) {
          changedLocal = true;
          var contents = fs.readFileSync(directory + "/" + filename);
          headerFoundLocal = contents.includes(header);
          break;
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
          errors = errors + `The changelog has changed in ${changelogLocation}, but the required header is missing.\n`;
        }
      } else if (changedLocal == false) {
        changed = false;
        headerFound = false;
        errors = errors + `The changelog was not changed in this pull request for ${changelogLocation}.\n`;
      }
    }

    core.setOutput('changed', changed.toString());
    core.setOutput('header', headerFound.toString());

    if (changed == false || headerFound == false) {
      const err = new Error(errors);
      err.stack = "";
      throw err;
    }

  } else {
    let modifiedFiles = await execAndReturnOutput(`git diff --name-only origin/${baseRef}..HEAD -- $(pwd) | grep -Ev '${ignoreFiles}'`);
    if (modifiedFiles.length <= 1) {
      changed = true;
      headerFound = true;
    }

    if (!changed || !headerFound) {
      for (const filename of gitChangedFiles) {
        if (filename.includes(file)) {
          changed = true;
          var contents = fs.readFileSync(directory + "/" + filename);
          headerFound = contents.includes(header);
        }
      }
    }
    
    changed = changed || false;
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
