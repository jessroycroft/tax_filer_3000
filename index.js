const promisify = require('promisify-node');

const { JiraApi } = require('jira');
const gitlog = promisify('gitlog');
const path = require('path');
const commandLineArgs = require('command-line-args');
const fs = require('fs');

const workspace = path.resolve('../../../workspace');

const gitRepos = [
  'acceptancetesting',
  'admin',
  'ansible',
  'api2',
  'core',
  'deploy-bootstrapper',
  'deploy-config',
  'devlocal',
  'fe',
  'flipbook-services',
  'platform-docs',
  'reco-engine',
  'recommendation-api',
  'shout-extension',
  'shout-v2',
  'shout-v2-host',
  'shout-v2-host-outlook',
  'sso',
  'uploads',
  'webhooks',
  'widget'
];

// Options for Jira API
const optionDefinitions = [
    { name: 'username', alias: 'u', type: String },
    { name: 'password', alias: 'p', type: String },
    { name: 'type', alias: 't', type: String },
    {
        name: 'filename',
        alias: 'f',
        type: String,
        defaultOption: true
    }
];
const options = commandLineArgs(optionDefinitions);

if (!options.username) {
    throw new Error('Missing username argument.');
}
if (!options.password) {
    throw new Error('Missing password argument.');
}
// if (!options.type) {
//     throw new Error('Missing type argument.');
// }

const jira = new JiraApi(
    'https',
    'uberflip.atlassian.net',
    443,
    options.username,
    options.password,
    '2'
);

function promiseJira(issueNumber) {
    return new Promise((resolve, reject) => {
        jira.findIssue(issueNumber, (err, issue) => {
            if (err) {
                console.log(`error ${issueNumber}`);
                reject(err);
            }
            return resolve(issue);
        })
    })
}

async function logIssueName(issueList) {
    const issueNames = await Promise.all(issueList.map(issue => promiseJira(issue)));
    return issueNames.map(issue => issue.id);
};

async function getCommits(options) {
    return await gitlog(options);
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function writeCommitsToFile(commits, repo) {
    fs.writeFile(`./downloaded_data/commits/commits_${repo}.json`, JSON.stringify(commits, null, 2));
}

async function writeIssuesToFile(commits) {
    const commitMessageRegex = /([A-Z]{3}[-][1-9]{5})/;
    const listOfIssues = commits
        .map(commit => {
            let issueNumber = commit.subject;
            const result = commitMessageRegex.exec(issueNumber);
            if (issueNumber && result) {
                return result[0];
            }
        })
        .filter(onlyUnique);
    const infoToWrite = await logIssueName(listOfIssues);
    fs.writeFile('info.json', JSON.stringify(infoToWrite, null, 2))
} 

async function init() {
    try {
        // gitRepos.forEach(async repo => {
        const gitlogOptions = {
            repo: `${workspace}/core`,
            since: 'NOV 1 2017',
            until: 'APR 6 2018',
            number: '50000',
            all: true,
            execOptions:
            {
                maxBuffer: 1000 * 1024
            }

        };
        const commits = await getCommits(gitlogOptions);
        // writeCommitsToFile(commits, repo);
        writeIssuesToFile(commits);
        // })
    } catch (err) {
        console.log(err);
    }
};

init();



