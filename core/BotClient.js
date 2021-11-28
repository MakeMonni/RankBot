const { Client } = require("discord.js");
const MemberHandler = require("./handlers/memberHandler.js");
const CommandHandler = require("./handlers/commandHandler.js");
const ScoreSaberUtils = require("./utils/scoresaber/scoresaberUtils.js");
const BeatSaverUtils = require("./utils/beatsaver/beatSaverUtils.js");
const MiscUtils = require("./utils/misc/miscUtils.js");
const BeatSaviorUtils = require("./utils/beatsavior/beatSaviorUtils.js");
const TwitchUtils = require("./utils/twitch/twitchUtils.js");
//const TAUtils = require("./utils/TA/TAUtils.js");

class BotClient extends Client {
    constructor(db, config, commands, options) {
        super(options);
        
        this.options.retryLimit = 3;
        this.options.restRequestTimeout = 30000

        this.memberHandler = new MemberHandler(this, db, config);
        this.memberHandler.init();

        this.commandHandler = new CommandHandler(this, config.prefix, commands);
        this.commandHandler.init();

        this.scoresaber = new ScoreSaberUtils(db, config, this);
        this.beatsaver = new BeatSaverUtils(db, this)
        this.misc = new MiscUtils(db, this)
        this.beatsavior = new BeatSaviorUtils(db, this);
        this.twitch = new TwitchUtils(this, config)
        //this.ta = new TAUtils(db, this)

        this.config = config;
        this.db = db;

        this.twitchAccessToken = "";
        this.streamsLive = [];
        this.updates = true;
    }

    checkIfOwner(message) {
        if (message.author.id === message.guild.ownerID) return true;
        else {
            message.channel.send(`Sorry you lack the permissions for this command.`);
            return false;
        }
    }
}
module.exports = BotClient;