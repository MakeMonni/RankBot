const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Randombsr extends Command {
    async run(client, message, args) {
        const map = await client.db.collection("beatSaverLocal").aggregate([{ $match: { automapper: false } }, { $sample: { size: 1 } }]).toArray();

        //Very spaghetti
        let njsString = "||";
        for (let i = 0; i < map[0].versions[0].diffs.length; i++) {
            njsString+= `\n${map[0].versions[0].diffs[i].difficulty} - ${map[0].versions[0].diffs[i].njs}` 
        }
        njsString+= "||"

        const embed = new Discord.MessageEmbed()
            .addField(`\u200b`, `||${map[0].metadata.songName} ${map[0].metadata.songSubName} by ${map[0].metadata.levelAuthorName}||`)
            .addField(`\u200b`, `\`!bsr ${map[0].key}\``)
            .addField(`\u200b`, `NJS: ${njsString}`)
            .addField(`\u200b`, `[Download](${map[0].versions[0].downloadURL}) | [BeatSaver](https://beatsaver.com/maps/${map[0].key.toLowerCase()}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${map[0].key})`);

        await message.channel.send(embed);
    }
}
module.exports = Randombsr;