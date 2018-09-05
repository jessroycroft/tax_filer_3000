const promisify = require('promisify-node');

const { JiraApi } = require('jira');
const searchJira = require('./searchJira')
const gitlog = promisify('gitlog');
const Bottleneck = require('bottleneck');
const path = require('path');
const commandLineArgs = require('command-line-args');
const mkdirp = require('mkdirp');
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

const limiter = new Bottleneck({
    minTime: 200
})

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

function sortVersionDates(versions) {
    return versions
        .filter(version => (version.startDate > '2017-11-01' && version.startDate < '2018-04-06') || (version.releaseDate > '2017-11-01' && version.releaseDate < '2018-04-06'))
        .map(version => version);
};

function getUniqueValues(value, index, self) {
    if (!value) return false;
    return self.indexOf(value) === index;
}

function getJiraIssueNumbersFromCommits(commits) {
    const commitMessageRegex = /((DEV)[-][1-9]{5})/; // regex to match the ABC-12345 format
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

async function init() {
    try {
        mkdirp('./downloaded_data/commits', err => { err ? console.log(err) : 'directory created!' });
        mkdirp('./downloaded_data/jira', err => { err ? console.log(err) : 'directory created!' });
        mkdirp(`./downloaded_data/jira/issues_from_commits`, err => { err ? console.log(err) : 'directory created!' });

        const updatedIssues = await limiter.schedule(searchJira, `project = DEV and ((created >= 2017-11-01 and created < 2018-04-06) or (updated >= 2017-11-01 and created < 2018-04-06) or status changed DURING (2017-11-01, 2018-04-01)) and (resolution is empty or resolution != LegacyBug)`); //query jira for issues

        const versions = sortVersionDates(await limiter.schedule(promiseJiraGetVersions, 'DEV')); // get all version between 2 dates
        const issuesInVersion = await Promise.all(versions.map(async version => await limiter.schedule(searchJira, `fixVersion in ("${version.id}")`))); // get all issues in versions between two dates not closed as LegacyBug

        mkdirp(`./downloaded_data/jira/versions`, err => { err ? console.log(err) : 'directory created!' });
        mkdirp(`./downloaded_data/jira/issues_in_versions`, err => { err ? console.log(err) : 'directory created!' });
        mkdirp(`./downloaded_data/jira/updated_issues`, err => { err ? console.log(err) : 'directory created!' });

        fs.writeFile(`./downloaded_data/jira/versions/versions.json`, JSON.stringify(versions, null, 2));
        fs.writeFile(`./downloaded_data/jira/issues_in_versions/issues_in_versions.json`, JSON.stringify(issuesInVersion, null, 2));
        fs.writeFile(`./downloaded_data/jira/updated_issues/updated_issues.json`, JSON.stringify(updatedIssues, null, 2));

        for (const repo of gitRepos) {
            const gitlogOptions = {
                repo: `${workspace}/${repo}`,
                since: 'NOV 1 2017',
                until: 'APR 6 2018',
                number: '50000',
                all: true,
                execOptions:
                {
                    maxBuffer: 1000 * 1024
                }
            };

            const commits = getJiraIssueNumbersFromCommits(await gitlog(gitlogOptions)); // get DEV-XXXXX format from commit message
            console.log(commits);
            const issuesInCommits = await limiter.schedule( searchJira, `key in ("${commits.join('", "')}")` ); //query jira for issues            

            mkdirp(`./downloaded_data/commits/${repo}`, err => { console.log(err) });
            mkdirp(`./downloaded_data/jira/issues_from_commits/${repo}`, err => { err ? console.log(err) : 'directory created!' });

            fs.writeFile(`./downloaded_data/commits/${repo}/commits.json`, JSON.stringify(commits, null, 2));
            fs.writeFile(`./downloaded_data/jira/issues_from_commits/${repo}/issues_from_commits.json`, JSON.stringify(issuesInCommits, null, 2));
        }
    } catch (err) {
        console.log(err);
    }
};

init();