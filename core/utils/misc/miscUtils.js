const Discord = require("discord.js");
const fetch = require('node-fetch');

class MiscUtils {
    constructor(db, client) {
        this.db = db;
        this.client = client;
    }

    async createPlaylist(playlistName, songs, imageLink, syncEndpoint, playlistDesc) {
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
        let syncurl = "";
        if (syncEndpoint) syncurl = syncEndpoint;

        const date = new Date();
        const dateString = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}`

        let playlist = {
            playlistTitle: playlistName,
            playlistAuthor: "RankBot",
            playlistDescription: `Playlist has ${songs.length} maps.\n` + playlistDesc + `\nPlaylist was created/updated on:\n${dateString}`,
            songs: songs,
            customData: {
                AllowDuplicates: false,
                syncURL: syncurl
            },
            image: image
        }

        return this.jsonAttachmentCreator(playlist, playlistName);
    }

    async jsonAttachmentCreator(json, name) {
        const string = JSON.stringify(json, null, 2)
        const buffer = Buffer.from(string, "utf-8");
        return new Discord.MessageAttachment(buffer, `${name}.json`);
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