const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Randombsr extends Command {
    async run(client, message, args) {
        const map = await client.db.collection("beatSaverLocal").aggregate([{ $match: { automapper: false } },{ $sample: { size: 1 } }]).toArray();
        
        const embed = new Discord.MessageEmbed()
            .addField(`\u200b`, `${map[0].metadata.songName} ${map[0].metadata.songSubName} by ${map[0].metadata.levelAuthorName}`)
            .addField(`\u200b`, `\`!bsr ${map[0].key}\``)
        
        await message.channel.send(embed);
    }
}
module.exports = Randombsr;