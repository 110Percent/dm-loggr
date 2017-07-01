const express = require('express');
const fs = require('fs-extra');
const Discord = require('discord.js');
const jsonFormat = require('json-format');
const moment = require('moment');

var config;

var dClient = new Discord.Client();
var app = express();


app.get('/', function (req, res) {
  res.send('Hello World')
})

app.get('/logs/:userID', (req, res) => {
    let baseHTML = fs.readFileSync('./utils/html/base.html', 'utf-8');
    let logHTML = {
        messageCreate: fs.readFileSync('./utils/html/createLog.html', 'utf-8'),
        messageDelete: fs.readFileSync('./utils/html/deleteLog.html', 'utf-8'),
        messageUpdate: fs.readFileSync('./utils/html/updateLog.html', 'utf-8')
    }
    let userID = req.params.userID
    if (!fs.existsSync('./db/' + userID + '.json')) {
        res.send('<h3>No logs for that user could be found. Sorry!</h3>');
        return;
    }
    let logJSON = fs.readJSONSync('./db/' + userID + '.json');
    let returnPage = baseHTML;
    let logObjects = [];
    for (let logID in logJSON) {
        let logObj = logJSON[logID];
        let thisHTML = logHTML[logObj.type];
        thisHTML = thisHTML.replace('%USERTAG%',logObj.author.username + '#' + logObj.author.discriminator);
        thisHTML = thisHTML.replace('%LOGTIMESTAMP%', logObj.timestamp);
        thisHTML = thisHTML.replace('%CONTENT%',logObj.content);
        if (logObj.type == 'messageUpdate') {
            thisHTML = thisHTML.replace('%OLDCONTENT%', logObj.oldContent)
        }
        logObjects.push(thisHTML);
    }
    returnPage = returnPage.replace('%EVENTLOGS%', logObjects.join('\n'));
    returnPage = returnPage.replace('%USERID%', userID);
    res.send(returnPage)

});

function init() {
    dirStructure();
    config = require('./utils/config.js');
    dClient.login(config.discordToken);
    app.listen(2793);
}

dClient.on('ready', () => {
    console.log('Signed in.');
})

dClient.on('message', (msg) => {
    logEvent('messageCreate', msg)
});

dClient.on('messageDelete', (msg) => {
    logEvent('messageDelete', msg);
})

dClient.on('messageUpdate', (oldMsg, newMsg) => {
    logEvent('messageUpdate', newMsg, oldMsg)
});

//Create the directory structure if it doesn't already exist.
function dirStructure() {
    const configExample = {
        discordToken: 'token here'
    }

    if (!fs.existsSync('./db')) {
        console.log('./db/ does not exist. Writing.');
        fs.mkdirSync('./db');
    }

    if (!fs.existsSync('./utils')) {
        console.log('./utils/ does not exist. Writing.');
        fs.mkdirSync('./utils');
    }

    if (!fs.existsSync('./utils/config-example.js')) {
        console.log('Config Example does not exist. Writing.');
        fs.writeFileSync('./utils/config-example.js', 'module.exports = ' + jsonFormat(configExample));
        console.log(require('./utils/config-example.js').discordToken)
    }

    if (!fs.existsSync('./utils/config.js')) {
        console.log('Config file does not exist. Copying from Config Example.');
        fs.copy('./utils/config-example.js', './utils/config.js');

    }
}

function logEvent(eType, msg, oldMsg) {
    // If the message comes from a guild channel or a Group DM, ignore it.
    if (msg.channel.name) {
        return;
    }

    if (!fs.existsSync('./db/' + msg.channel.recipient.id + '.json')) {
        fs.writeJSONSync('./db/' + msg.channel.recipient.id + '.json', {});
    }

    let logJSON = fs.readJSONSync('./db/' + msg.channel.recipient.id + '.json');
    let thisTimestamp = Date.now();

    logJSON[thisTimestamp] = {
        type: eType,
        id: msg.id,
        timestamp: moment(thisTimestamp).format('dddd, MMMM Do YYYY, h:mm:ss a'),
        content: msg.cleanContent,
        oldContent: oldMsg ? oldMsg.cleanContent : null,
        author: {
            username: msg.author.username,
            discriminator: msg.author.discriminator,
            avatarURL: msg.author.avatarURL
        }
    }

    fs.writeFileSync('./db/' + msg.channel.recipient.id + '.json', jsonFormat(logJSON));
}

init();