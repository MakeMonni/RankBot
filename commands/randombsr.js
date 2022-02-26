const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Randombsr extends Command {
    async run(client, message, args) {
        const map = await client.db.collection("beatSaverLocal").aggregate([{ $match: { automapper: false } }, { $sample: { size: 1 } }]).toArray();

        let njsString = "||";
        const mapDiffs = map[0].versions[0].diffs;
        for (let i = 0; i < mapDiffs.length; i++) {
            njsString += `${mapDiffs[i].difficulty} - ${mapDiffs[i].njs}`
            if (i != mapDiffs.length) njsString += `\n`
        }
        njsString += "||"

        const mapMinutes = Math.floor(map[0].metadata.duration / 60)
        const mapSecond =  (map[0].metadata.duration - mapMinutes * 60).toString().padStart(2, "0")

        const embed = new Discord.MessageEmbed()
            .addField(`Map`, `||${map[0].metadata.songName} ${map[0].metadata.songSubName} by ${map[0].metadata.levelAuthorName}||`)
            .addField(`\u200b`, `\`!bsr ${map[0].key}\``)
            .addField(`Duration`, `${mapMinutes}:${mapSecond}`)
            .addField(`NJS`, `${njsString}`)
            .addField(`\u200b`, `[Download](${map[0].versions[0].downloadURL}) | [BeatSaver](https://beatsaver.com/maps/${map[0].key.toLowerCase()}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${map[0].key})`);

        await message.channel.send(embed);
    }
}
module.exports = Randombsr;