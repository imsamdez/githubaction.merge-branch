import * as core from '@actions/core';
import * as github from '@actions/github';
import {ActionInputs, GithubStatus} from './enums';
import {string2boolean} from './helpers';

const octokit = github.getOctokit(core.getInput(ActionInputs.GITHUB_TOKEN));
const repo = github.context.repo;

async function run(): Promise<void> {
  const base = core.getInput(ActionInputs.BRANCH_BASE);
  const compare = core.getInput(ActionInputs.BRANCH_COMPARE);
  const waitForCi = string2boolean(core.getInput(ActionInputs.WAIT_FOR_CI));
  const isBaseExist = await isBranchExist(base);
  const isCompareExist = await isBranchExist(compare);
  let compareStatus = null;

  if (isBaseExist === false) {
    return core.setFailed(`Base branch (${base}) could not be found!`);
  }
  if (isCompareExist === false) {
    return core.setFailed(`Compare branch (${compare}) could not be found!`);
  }
  if (waitForCi === true) {
    compareStatus = await getBranchStatus(compare);

    if (compareStatus === GithubStatus.SUCCESS) {
      // @TODO Implement a retrial mechanism
      return core.setFailed(
        `Compare branch (${compare}) not ready for merge! Current status is ${compareStatus}!`
      );
    }
  }
  try {
    await merge(base, compare);
    return;
  } catch (err) {
    return core.setFailed(`Merge failed! ${err.message}`);
  }
}

async function isBranchExist(branch: string): Promise<boolean> {
  const resultBranch = await octokit.repos
    .getBranch({
      ...repo,
      branch
    })
    .then(response => response.data);

  core.debug(
    `isBranchExist - getBranch returned ${JSON.stringify(resultBranch)}`
  );
  return resultBranch != null;
}
async function getBranchStatus(branch: string): Promise<GithubStatus | null> {
  const resultStatus = await octokit.repos
    .listCommitStatusesForRef({
      ...repo,
      ref: branch
    })
    .then(response => response.data);

  core.debug(
    `getBranchStatus - listCommitStatusesForRef returned ${JSON.stringify(
      resultStatus
    )}`
  );
  if (resultStatus.length !== 0) {
    return resultStatus[0].state as GithubStatus;
  }
  return null;
}

async function merge(base: string, head: string): Promise<void> {
  try {
    await octokit.repos
      .merge({
        ...repo,
        base,
        head
      })
      .then(response => response.data);

    core.debug(`merge - Successfully done! (${base} ← ${head})`);
  } catch (err) {
    return Promise.reject(err);
  }
}

run();
