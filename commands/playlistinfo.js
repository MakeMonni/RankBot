const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const fetch = require('node-fetch');

class PlaylistInfo extends Command {
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
                message.channel.send("Something went wrong downloading the playlist.")
                console.log(err)
            }

            let difficultyDataArr = [];
            let mapInfo = "Playlistdata:\n";
            for (let i = 0; i < data.songs.length; i++) {
                let mapHash = data.songs[i].hash;

                let map = await client.beatsaver.findMapByHash(mapHash);

                if (!map) {
                    mapInfo = mapInfo + (`Could not find map ${data.songs[i].hash}\n-=-\n`)
                }
                else {
                    mapInfo = mapInfo + (`${map.metadata.songName} ${map.metadata.songSubName} - ${map.metadata.songAuthorName} by ${map.metadata.levelAuthorName}\nKey: ${map.key} | BPM: ${map.metadata.bpm}`);
                    if (data.songs[i]?.difficulties !== undefined && data.songs[i]?.difficulties.length > 0) {
                        const versionIndex = map.versions.findIndex(versions => versions.hash === data.songs[i].hash.toUpperCase());

                        for (let j = 0; j < data.songs[i].difficulties.length; j++) {
                            const difficultyData = map.versions[versionIndex]?.diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(data.songs[i].difficulties[j].characteristic) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(data.songs[i].difficulties[j].name));
                            if (!difficultyData) mapInfo = mapInfo + `\nBut map did not have difficulty ${data.songs[i].difficulties[0].name}...`;
                            else {
                                const diff = client.beatsaver.convertDiffNameVisual(data.songs[i].difficulties[j].name);
                                const category = data.songs[i].difficulties[j].characteristic;
                                difficultyDataArr.push(difficultyData);

                                mapInfo = mapInfo + `\n| NJS: ${difficultyData.njs} | NPS: ${Math.round(difficultyData.nps * 100) / 100} | ${category}-${diff}`;
                            }
                        }
                    }
                    mapInfo = mapInfo + `\n-=-\n`;
                }
            }

            if (difficultyDataArr.length > 1) {
                const peakNPS = Math.round(Math.max.apply(Math, difficultyDataArr.map(function (e) { return e.nps })) * 100) / 100;
                const minNPS = Math.round(Math.min.apply(Math, difficultyDataArr.map(function (e) { return e.nps })) * 100) / 100;
                const avgNPS = Math.round(difficultyDataArr.reduce((p, c) => p + c.nps, 0) / difficultyDataArr.length * 100) / 100;
                const peakNJS = Math.max.apply(Math, difficultyDataArr.map(function (e) { return e.njs }))
                const minNJS = Math.min.apply(Math, difficultyDataArr.map(function (e) { return e.njs }))
                const avgNJS = Math.round(difficultyDataArr.reduce((p, c) => p + c.njs, 0) / difficultyDataArr.length * 100) / 100;

                mapInfo = `=- Peak - Avg - Min -=\nNPS: ${peakNPS} - ${avgNPS} - ${minNPS}\nNJS: ${peakNJS} - ${avgNJS} - ${minNJS}\n-===========-\n` + mapInfo
            }
            mapInfo = `Playlist has ${data.songs.length} maps.\n` + mapInfo;

            const mapInfoBuffer = Buffer.from(mapInfo, "utf-8");
            const mapInfoAttachment = new Discord.MessageAttachment(mapInfoBuffer, `Playlist_${data.playlistTitle}_Info.txt`);

            message.channel.send("Here is your info :)", mapInfoAttachment);
        }
        else {
            message.channel.send("This is not a valid playlist data type. Supported types: .json & .bplist")
        }
    }
}
module.exports = PlaylistInfo;