const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const fetch = require('node-fetch');

class PlaylistUpdate extends Command {
    async run(client, message, args) {
        if (!message.attachments.array()[0]) {
            await message.channel.send("No attachment provided.")
            return;
        }
        const attachmentURL = message.attachments.array()[0].attachment;
        if (attachmentURL.endsWith(".json") || attachmentURL.endsWith(".bplist")) {
            let data;
            try {
                data = await fetch(`${attachmentURL}`).then(res => res.json());
            } catch (err) {
                await message.channel.send("Something went wrong downloading the playlist.")
                console.log(err)
            }

            let mapsUpdated = 0;
            let errored = 0

            try {
                for (let i = 0; i < data.songs.length; i++) {
                    let mapHash = data.songs[i].hash;
                    let map = await client.beatsaver.findMapByHash(mapHash);

                    if (!map) {
                        errored++;
                        continue;
                    }
                    else if (mapHash !== map?.versions[0].hash) {
                        mapsUpdated++;
                        data.songs[i].levelid = `custom_level_${map.versions[0].hash}`;
                        data.songs[i].hash = map.versions[0].hash;
                    }
                }

                const playlistString = JSON.stringify(data, null, 2);
                const playlistBuffer = Buffer.from(playlistString, "utf-8");
                const playlist = new Discord.MessageAttachment(playlistBuffer, `${data.playlistTitle}.json`);

                await message.channel.send(`Updated your playlist.\nUpdated ${mapsUpdated} maps.\nFailed on ${errored} maps.`, playlist);
            }
            catch (err) {
                await message.channel.send("Failed to update this playlist, make sure it is a correct playlist.")
                console.log(err);
            }

        }
        else {
            await message.channel.send("This is not a valid playlist data type. Supported types: json, bplist")
        }
    }
}
module.exports = PlaylistUpdate;