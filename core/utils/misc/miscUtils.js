const Discord = require("discord.js");
const fetch = require('node-fetch');

class MiscUtils {
    constructor(db, client) {
        this.db = db;
        this.client = client;
    }

    async createPlaylist(playlistName, songs, imageLink) {
        let image = "";
        if (imageLink) {
            try {
                const imageType = imageLink.split(".")[imageLink.split(".").length - 1];
                image = await fetch(`${imageLink}`)
                    .then(res => res.buffer())
                    .then(buf => `data:image/${imageType};base64,` + buf.toString('base64'))
            } catch (err) {
                console.log(err)
            }
        }

        const playlist = {
            playlistTitle: playlistName,
            playlistAuthor: "RankBot",
            playlistDescription: "",
            customData: { AllowDuplicates: false },
            songs: songs,
            image: image
        }

        const playlistString = JSON.stringify(playlist, null, 2);
        const playlistBuffer = Buffer.from(playlistString, "utf-8");

        return new Discord.MessageAttachment(playlistBuffer, `${playlistName}.json`);
    }

    //https://discordjs.guide/miscellaneous/parsing-mention-arguments.html#using-regular-expressions
    async getUserFromMention(mention) {
        // The id is the first and only match found by the RegEx.
        const matches = mention.match(/^<@!?(\d+)>$/);

        // If supplied variable was not a mention, matches will be null instead of an array.
        if (!matches) return;

        // However the first element in the matches array will be the entire mention, not just the ID,
        // so use index 1.
        const id = matches[1];

        return await this.client.users.cache.get(id);
    }
}
module.exports = MiscUtils;