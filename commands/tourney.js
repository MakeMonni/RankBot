const Command = require("../core/command/command.js");

class Tourney extends Command {
    async run(client, message, args) {
        let role = message.guild.roles.cache.filter(role => role.name === "Turnausilmoitukset").first();
        if (role === undefined) {
            console.log(`Role Turanausilmotukset did not exist. Creating.`);

            await message.guild.roles.create({
                data: {
                    name: "Turnausilmoitukset"
                }
            }).catch(err => console.error(`Failed to create role Turnausilmoitukset`, err));

            role = message.guild.roles.cache.filter(role => role.name === "Turnausilmoitukset").first();
        }
        await message.member.roles.add(role);
        message.channel.send("You now have tourney role, prepare to be pinged on tourney stuff.\nMessage an admin if you want this removed.");
    }
}
module.exports = Tourney;