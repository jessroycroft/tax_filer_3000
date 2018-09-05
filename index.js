const promisify = require('promisify-node');

const { JiraApi } = require('jira');
const searchJira = require('./searchJira')
const getVersionIds = require('./getVersions');
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
];
const options = commandLineArgs(optionDefinitions);

if (!options.username) {
    throw new Error('Missing username argument.');
}
if (!options.password) {
    throw new Error('Missing password argument.');
}

function promiseJiraGetVersions(projectId) {
    const result = new Promise((resolve, reject) => {
        jira.getVersions(projectId, (err, version) => {
            if (err) {
                if (err === 'Invalid project ID.') {
                    // If the issue doesn't exist anymore, thats still okay.
                    console.log(
                        'Project id is invalid, continuing...',
                        `Project Id: ${projectId}`
                    );
                    resolve(false);
                } else {
                    console.log(`error ${projectId}`);
                    reject(err);
                }
            }
            return resolve(version);
        });
    });
    return result;
}

async function writeVersionsToFile(projectId) {
    const data = await getVersionData(projectId);
    // fs.writeFile(`./downloaded_data/jira_data/versions_${repo}.json`, JSON.stringify(commits, null, 2));
}

function sortVersionDates(versions) {
    return versions
        .filter(version => (version.startDate > '2017-11-01' && version.startDate < '2018-04-06') || (version.releaseDate > '2017-11-01' && version.releaseDate < '2018-04-06'))
        .map(version => version);
};

function getUniqueValues(value, index, self) {
    if (!value) return false;
    return self.indexOf(value) === index;
}

function writeCommitsToFile(commits, repo) {
    // uncomment to write to file
    // fs.writeFile(`./downloaded_data/commits/commits_${repo}.json`, JSON.stringify(commits, null, 2));
}

async function writeIssueDataToFile(listOfIssues) {
    const jiraData = await getIssueData(listOfIssues);
    const jiraObj = {};
    jiraData.forEach((issue, index) => {
        jiraObj[index] = {
            'key': issue.key,
            'url': issue.self,
            'id': issue.id,
            'summary': issue.fields.summary,
            'status': issue.fields.status,
            'resolution': issue.fields.resolution
        }
    })
    // uncomment to write to file
    // fs.writeFile('./downloaded_data/jira_data/info.json', JSON.stringify(jiraObj, null, 2));
}

function getJiraIssueNumbers(commits) {
    const commitMessageRegex = /([A-Z]{3}[-][1-9]*)/; // regex to match the ABC-12345 format
    const listOfIssues = commits
        .map(commit => {
            let issueNumber = commit.subject;
            const result = commitMessageRegex.exec(issueNumber);
            if (issueNumber && result) {
                // grab the first full match of ABC-12345 from the beginning of the commit message
                return result[0];
            }
        })
        .filter(getUniqueValues); // filter out commits from the same branch
    return listOfIssues;
}

const jira = new JiraApi(
  'https',
  'uberflip.atlassian.net',
  443,
  'jess.roycroft@uberflip.com',
  'GarbageCatBen',
  'latest'
);

function wasUpdated(issue) {
  return (
    (issue.createdDate > '2017-11-01' && issue.createdDate < '2018-04-06') ||
    (issue.updated > '2017-11-01' && issue.updated < '2018-04-06')
  );
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
        const commits = getJiraIssueNumbers(await gitlog(gitlogOptions)); // get DEV-XXXXX format from commit message
        const issuesInCommits = await searchJira(`key in ("${commits.join('", "')}")`); //query jira for issues

        const updatedIssues = issuesInCommits.filter(issue => wasUpdated(issue)); // get updated versions between 2 dates
        
        const versions = sortVersionDates(await promiseJiraGetVersions('DEV')); // get all version between 2 dates
        const issuesInVersion = await Promise.all(versions.map(async version => await searchJira(`fixVersion in ("${version.id}") AND resolution NOT IN ("LegacyBug")`))); // get all issues in versions between two dates not closed as LegacyBug

        // writeCommitsToFile(commits, repo);
        // writeIssuesInCommitsToFile(issuesinCommits, repo);
        // writeUpdatedIssuesToFile(updatedIssues, repo);
        // writeVersionsToFile(versions, repo);
        // writeIssuesInVersionToFile(issuesInVersion, repo);

    } catch (err) {
        console.log(err);
    }
};

init();