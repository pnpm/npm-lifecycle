'use strict'

// Source Code from: https://github.com/sindresorhus/is-docker/blob/main/index.js
const fs = require('fs');

module.exports = isDocker;

let isDockerCached;

function hasDockerEnv() {
  try {
    fs.statSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
}

function isDocker() {
  if (isDockerCached === undefined) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup();
  }

  return isDockerCached;
}

