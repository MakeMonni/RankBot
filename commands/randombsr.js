const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Randombsr extends Command {
    async run(client, message, args) {
        const map = await client.db.collection("beatSaverLocal").aggregate([{ $match: { automapper: false } }, { $sample: { size: 1 } }]).toArray();

        let njsString = "||";
        const mapDiffs = map[0].versions[0].diffs;
        let randomDiffIndex = -1;
        if (args[0] === "diff") {
            let possibleDiffs = Array.from(Array(mapDiffs.length).keys()); //Array containing all diff indexes
            let index = Math.floor(Math.random() * possibleDiffs.length);
            //Loop through possible diffs in random order until one with more than 0 notes is found
            while (mapDiffs[possibleDiffs[index]].notes === 0 && possibleDiffs.length > 0) {
                possibleDiffs.splice(index, 1);
                index = Math.floor(Math.random() * possibleDiffs.length);
            }
            if (possibleDiffs.length > 0) randomDiffIndex = possibleDiffs[index];
        }      
        for (let i = 0; i < mapDiffs.length; i++) {
            njsString += `${mapDiffs[i].characteristic} - ${mapDiffs[i].difficulty} - ${mapDiffs[i].njs}`
            if (i === randomDiffIndex) njsString += `🔹`;
            if (i != mapDiffs.length) njsString += `\n`
        }
        if (args[0] === "diff" && randomDiffIndex === -1) {
            njsString += `\n⚠️ No difficulty with more than 0 notes found!`;
        }
        njsString += "||"

        const mapMinutes = Math.floor(map[0].metadata.duration / 60)
        const mapSecond =  (map[0].metadata.duration - mapMinutes * 60).toString().padStart(2, "0")

        const embed = new Discord.MessageEmbed()
            .addField(`Map`, `||${map[0].metadata.songName} ${map[0].metadata.songSubName} by ${map[0].metadata.levelAuthorName}||`)
            .addField(`\u200b`, `\`!bsr ${map[0].key}\``)
            .addField(`Duration`, `${mapMinutes}:${mapSecond}`)
            .addField(`NJS`, `${njsString}`)
            .addField(`\u200b`, `[Download](${map[0].versions[0].downloadURL}) | [BeatSaver](https://beatsaver.com/maps/${map[0].key.toLowerCase()}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${map[0].key}) | [Mapchecker](https://kivalevan.me/BeatSaber-MapCheck/?id=${map[0].key})`);
        
        await message.channel.send(embed);
    }
}
module.exports = Randombsr;