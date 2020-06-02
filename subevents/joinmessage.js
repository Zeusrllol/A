module.exports.run = member => {
    let channel = member.guild.channels.cache.get("360716684174032896");
	if (!channel) return;
	let joinMessage = `Welcome to ${member.guild.name}'s ${channel}, <@${member.id}>.\nTo verify yourself as someone who plays osu!droid or interested in the game and open the rest of the server, you can follow *any* of the following methods:\n\n- post your osu!droid screenshot (main menu if you are an online player or recent result (score) if you are an offline player). If you've just created an osu!droid account, please submit a score to the account before verifying\n\n- post your osu! profile (screenshot or link to profile) and reason why you join this server\n\nafter that, you can ping Moderator or Helper role and wait for one to come to verify you.\n\n**Do note that you have 1 day to verify, otherwise you will be automatically kicked.**`;
	channel.send(joinMessage)
};

module.exports.config = {
    name: "joinmessage"
};