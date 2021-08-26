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

    const daily = schedule.scheduleJob('0 15 * * *', async function () {
        console.log("Daily updates");
        await botClient.scoresaber.scoreTracker();
    });

    const roleUpdates = schedule.scheduleJob('0 0,6,12,18 * * *', async function () {
        if (botClient.updates) {
            await botClient.scoresaber.updateAllRoles();
        }
    })

    await botClient.login(config.token);
    botClient.user.setActivity(`Need help? Use ${botClient.config.prefix}help`);

    await db.collection("discordRankBotScores").createIndex({ hash: 1, player: 1, leaderboardId: 1 });
    await db.collection("discordRankBotUsers").createIndex({ scId: 1, discId: 1 });
    await db.collection("scoresaberRankedMaps").createIndex({ hash: 1 });
    await db.collection("beatSaverLocal").createIndex({ key: 1, "versions.hash": 1 });
});