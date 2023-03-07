const config = require("./config.json");
const BotClient = require("./core/BotClient.js");
const CommandLoader = require("./core/command/loader.js");
const MongoClient = require("mongodb").MongoClient;
const schedule = require('node-schedule');

MongoClient.connect(config.mongourl, async (err, client) => {
    if (err !== null) throw new Error(`Database connection failed: ${err}`);

    const db = client.db(config.dbName);
    const commands = await CommandLoader.loadCommands();
    const botClient = new BotClient(db, config, commands);

    const statusUpdate = schedule.scheduleJob('*/2 * * * *', async function () {
        await botClient.user.setActivity(`Need help? Use ${botClient.config.prefix}help`);
    })

    const daily = schedule.scheduleJob('0 7 * * *', async function () {
        console.log("Daily updates");
        await botClient.scoresaber.scoreTracker();
        await botClient.scoresaber.scorePrehandler();
        await botClient.scoresaber.rankTracker();
        await botClient.beatsaver.deletionChecker();
    });

    const roleUpdates = schedule.scheduleJob('0 0,6,12,18 * * *', async function () {
        if (botClient.updates) {
            await botClient.scoresaber.updateAllRoles();
        }
    })

    await botClient.login(config.token);
    await botClient.user.setActivity(`Need help? Use ${botClient.config.prefix}help`);

    const landedUsers = await db.collection("landingMemberList").find().toArray();
    if (landedUsers.length > 0) {
        for (let i = 0; i < landedUsers.length; i++) {
            const toBeKickedIn = landedUsers[i].toBeKickedDate - Date.now();
            if (toBeKickedIn > 0) setTimeout(botClient.memberHandler.newMemberTimerMessage, landedUsers[i].toBeKickedDate - Date.now(), botClient, landedUsers[i].userId);
            else botClient.memberHandler.newMemberTimerMessage(botClient, landedUsers[i].userId);
        }
    }

    await db.collection("discordRankBotScores").createIndex({ hash: 1, player: 1, leaderboardId: 1 });
    await db.collection("discordRankBotScores").createIndex({ hash: 1, player: 1 });
    await db.collection("discordRankBotScores").createIndex({ country: 1, ranked: 1 });
    await db.collection("discordRankBotUsers").createIndex({ scId: 1, discId: 1 });
    await db.collection("scoresaberRankedMaps").createIndex({ hash: 1 });
    await db.collection("beatSaverLocal").createIndex({ key: 1, "versions.hash": 1 });
    await db.collection("beatSaverLocal").createIndex({ "versions.hash": 1 });
    await db.collection("beatSaverLocal").createIndex({ "metadata.levelAuthorName": "text" })
});