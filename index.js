const core = require('@actions/core');
const exec = require('@actions/exec');
const execa = require('execa');
const fs = require('fs');
const path = require('path');

const directory = process.env.GITHUB_WORKSPACE;
const eventPath = process.env.GITHUB_EVENT_PATH;
const header = core.getInput('header');
const file = core.getInput('file');
const ignoreFiles = core.getInput('ignoreFiles');
const lerna = (core.getInput('lerna').toLowerCase() === "true");
const yarnWorkspaces = (core.getInput('yarnWorkspaces').toLowerCase() === "true");

const REPORT_ISSUE = `
Please provide a link with the failing build to:
https://github.com/awharn/check_changelog_action/issues/new
`;

let changes;
let changed;
let headerFound;

async function execAndReturnOutput(command) {
  let capturedOutput = "";
  const options = {
    listeners: {
      stdout: (data) => {
        if (data != null){
          capturedOutput += data.toString();
        }
      }
    }
  }
  await exec.exec(command, undefined, options);
  return capturedOutput;
}

async function execAndReturnOutputExeca(command) {
  let capturedOutput = "";
  const options = {
    shell: "/bin/bash"
  }
  let result = await execa(command, undefined, options);
  capturedOutput = result.stdout;
  return capturedOutput;
}

async function checkChangelog() {
  const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
  const baseRef = eventData.pull_request.base.ref;
  const gitChangedFiles = (await execAndReturnOutput(`git --no-pager diff origin/${baseRef} --name-only`)).trim().split("\n");
  let errors = "";

  if (lerna || yarnWorkspaces) {
    let packages = [];
    if (yarnWorkspaces) {
      const yarnVersion = (await execAndReturnOutput("npx yarn --version")).trim();
      if (yarnVersion.startsWith("1.")) {
        const workspaceInfo = JSON.parse((await execAndReturnOutput("npx yarn workspaces info --json --silent")).trim().split("\n").slice(1, -1).join(""));
        for (const p in workspaceInfo) {
          packages.push({
            name: p,
            location: workspaceInfo[p].location
          });
        }
      } else if (yarnVersion.startsWith("2.")) {
        // TODO: test yarn 2.x support
        packages = JSON.parse((await execAndReturnOutput("npx yarn workspaces info --json")).trim());
      } else {
        changes = false;
        changed = false;
        headerFound = false;
        core.error(`Only Yarn 1.x and 2.x are supported. ${REPORT_ISSUE}`);
      }
    } else if (lerna) {
      packages = JSON.parse(await execAndReturnOutput(`npx lerna@6 list --since origin/${baseRef} --exclude-dependents --json --loglevel silent`));
    }

    for (const package of packages) {
      const resolvedPkgDir = path.join(path.relative(directory, package.location));
      let modifiedFiles = await execAndReturnOutputExeca(`git diff --name-only origin/${baseRef}..HEAD -- ${resolvedPkgDir} | grep -Ev '${ignoreFiles}' || true`);
      if (modifiedFiles.length == 0) {
        packages = packages.filter(packages => packages.name != package.name);
      }
    }

    if (packages.length == 0) {
      changes = false;
      changed = false;
      headerFound = false;
    } else {
      changes = true;
      for (const package of packages) {
        const changelogLocation = path.join(path.relative(directory, package.location), file);
        let changedLocal = false;
        let headerFoundLocal = false;
        for (const filename of gitChangedFiles) {
          if (filename == changelogLocation) {
            changedLocal = true;
            let contents = fs.readFileSync(directory + "/" + filename);
            headerFoundLocal = contents.includes(header);
            break;
          }
        }

        if (changedLocal === true) {
          if (changed == null) {
            changed = true;
          }

          if (headerFoundLocal === true && headerFound == null) {
            headerFound = true;
          } else if (headerFoundLocal === false) {
            headerFound = false;
            errors = errors + `The changelog has changed in ${changelogLocation}, but the required header is missing.\n`;
          }
        } else if (changedLocal === false) {
          changed = false;
          headerFound = false;
          errors = errors + `The changelog was not changed in this pull request for ${changelogLocation}.\n`;
        }
      }
    }
  } else {
    let modifiedFiles = await execAndReturnOutputExeca(`git diff --name-only origin/${baseRef}..HEAD -- $(pwd) | grep -Ev '${ignoreFiles}' || true`);
    if (modifiedFiles.length > 0) {
      changes = true;
      for (const filename of gitChangedFiles) {
        if (filename.includes(file)) {
          changed = true;
          let contents = fs.readFileSync(path.join(directory, filename));
          headerFound = contents.includes(header);
        }
      }
    }

    changes = changes || false;
    changed = changed || false;
    headerFound = headerFound || false;

    if (changes == true) {
      if (changed == false) {
        errors = errors + "The changelog was not changed in this pull request.";
      }
      if (headerFound == false) {
        errors = errors + "The changelog has changed, but the required header is missing.";
      }
    }
  }

  // Handle issues with this action
  if (changes === undefined) core.error(`Changes is undefined. ${REPORT_ISSUE}`);
  if (changed === undefined) core.error(`Changed is undefined. ${REPORT_ISSUE}`);
  if (headerFound === undefined) core.error(`HeaderFound is undefined. ${REPORT_ISSUE}`);

  if (changes === true && (changed === false || headerFound === false)) {
    const err = new Error(errors);
    err.stack = "";
    throw err;
  }

  core.setOutput('changes', changes.toString());
  core.setOutput('changed', changed.toString());
  core.setOutput('header', headerFound.toString());
}

checkChangelog().catch((error) => {
  core.setFailed(error.message);
});
