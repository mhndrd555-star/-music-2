const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { search } = require('youtube-sr');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// إنشاء العميل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// قائمة الأغاني
let queue = [];
let isPlaying = false;
let currentSong = null;
let audioPlayer = createAudioPlayer();
let currentGuild = null;
let currentChannel = null;

// إعداد Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// أوامر البوت
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية من اليوتيوب')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('اسم الأغنية أو رابط اليوتيوب')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('تشغيل قائمة تشغيل من اليوتيوب')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('رابط قائمة التشغيل من اليوتيوب')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('تخطي الأغنية الحالية'),
    
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('إيقاف التشغيل'),
    
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('عرض قائمة الأغاني'),
    
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('إيقاف مؤقت'),
    
    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('استكمال التشغيل'),
    
    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('إرسال لوحة التحكم في الروم')
];

// تسجيل الأوامر
// تحميل متغيرات البيئة
require('dotenv').config();

// استخدام متغيرات البيئة أو ملف config
const config = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || require('./config').DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID || require('./config').CLIENT_ID
};
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

(async () => {
    try {
        console.log('جاري تسجيل الأوامر...');
        await rest.put(
            Routes.applicationCommands(config.CLIENT_ID),
            { body: commands }
        );
        console.log('تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('خطأ في تسجيل الأوامر:', error);
    }
})();

// دالة تشغيل الأغنية
async function playSong(interaction, song) {
    try {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply('يجب أن تكون في قناة صوتية!');
        }
        
        currentGuild = interaction.guild;
        currentChannel = voiceChannel;
        
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        
        await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
        
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            highWaterMark: 1 << 25
        });
        
        const resource = createAudioResource(stream);
        audioPlayer.play(resource);
        
        connection.subscribe(audioPlayer);
        
        const embed = new EmbedBuilder()
            .setTitle('🎵 تشغيل الأغنية')
            .setDescription(`**${song.title}**`)
            .setThumbnail(song.thumbnail)
            .setColor('#00ff00')
            .addFields(
                { name: 'المدة', value: song.duration, inline: true },
                { name: 'القناة', value: song.channel, inline: true }
            );
        
        if (interaction) {
            await interaction.reply({ embeds: [embed] });
        }
        
        audioPlayer.on(AudioPlayerStatus.Idle, () => {
            if (queue.length > 0) {
                const nextSong = queue.shift();
                currentSong = nextSong;
                playSong(null, nextSong);
            } else {
                isPlaying = false;
                currentSong = null;
                connection.destroy();
            }
        });
        
    } catch (error) {
        console.error('خطأ في تشغيل الأغنية:', error);
        if (interaction) {
            interaction.reply('حدث خطأ في تشغيل الأغنية!');
        }
    }
}

// دالة البحث عن الأغاني
async function searchSong(query) {
    try {
        if (ytdl.validateURL(query)) {
            const info = await ytdl.getInfo(query);
            return {
                title: info.videoDetails.title,
                url: query,
                thumbnail: info.videoDetails.thumbnails[0].url,
                duration: info.videoDetails.lengthSeconds,
                channel: info.videoDetails.author.name
            };
        } else {
            const results = await search(query, { limit: 1 });
            if (results.length > 0) {
                const video = results[0];
                return {
                    title: video.title,
                    url: video.url,
                    thumbnail: video.thumbnail.url,
                    duration: video.durationFormatted,
                    channel: video.channel.name
                };
            }
        }
    } catch (error) {
        console.error('خطأ في البحث:', error);
        return null;
    }
}

// معالج الأحداث
client.once('ready', () => {
    console.log(`البوت متصل باسم: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'play') {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();
        
        const song = await searchSong(query);
        if (!song) {
            return interaction.editReply('لم يتم العثور على الأغنية!');
        }
        
        if (isPlaying) {
            queue.push(song);
            const embed = new EmbedBuilder()
                .setTitle('➕ تم إضافة الأغنية للقائمة')
                .setDescription(`**${song.title}**`)
                .setColor('#0099ff');
            return interaction.editReply({ embeds: [embed] });
        }
        
        currentSong = song;
        isPlaying = true;
        await playSong(interaction, song);
    }
    
    if (commandName === 'playlist') {
        const url = interaction.options.getString('url');
        
        await interaction.deferReply();
        
        try {
            // هذا مثال بسيط - في الواقع تحتاج مكتبة خاصة لقوائم التشغيل
            const embed = new EmbedBuilder()
                .setTitle('📋 قائمة التشغيل')
                .setDescription('تم إضافة قائمة التشغيل للقائمة')
                .setColor('#ff9900');
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('حدث خطأ في تحميل قائمة التشغيل!');
        }
    }
    
    if (commandName === 'skip') {
        if (!isPlaying) {
            return interaction.reply('لا يوجد أغنية قيد التشغيل!');
        }
        
        audioPlayer.stop();
        const embed = new EmbedBuilder()
            .setTitle('⏭️ تم تخطي الأغنية')
            .setColor('#ff0000');
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'stop') {
        if (!isPlaying) {
            return interaction.reply('لا يوجد أغنية قيد التشغيل!');
        }
        
        queue = [];
        audioPlayer.stop();
        isPlaying = false;
        currentSong = null;
        
        const embed = new EmbedBuilder()
            .setTitle('⏹️ تم إيقاف التشغيل')
            .setColor('#ff0000');
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'queue') {
        if (queue.length === 0 && !currentSong) {
            return interaction.reply('القائمة فارغة!');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📋 قائمة الأغاني')
            .setColor('#0099ff');
        
        if (currentSong) {
            embed.addFields({ name: '🎵 الآن', value: currentSong.title, inline: false });
        }
        
        if (queue.length > 0) {
            const queueList = queue.slice(0, 10).map((song, index) => 
                `${index + 1}. ${song.title}`
            ).join('\n');
            embed.addFields({ name: '⏭️ التالية', value: queueList, inline: false });
        }
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'pause') {
        if (!isPlaying) {
            return interaction.reply('لا يوجد أغنية قيد التشغيل!');
        }
        
        audioPlayer.pause();
        const embed = new EmbedBuilder()
            .setTitle('⏸️ تم إيقاف التشغيل مؤقتاً')
            .setColor('#ffaa00');
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'resume') {
        if (!isPlaying) {
            return interaction.reply('لا يوجد أغنية قيد التشغيل!');
        }
        
        audioPlayer.unpause();
        const embed = new EmbedBuilder()
            .setTitle('▶️ تم استكمال التشغيل')
            .setColor('#00ff00');
        
        await interaction.reply({ embeds: [embed] });
    }
    
    if (commandName === 'dashboard') {
        const embed = new EmbedBuilder()
            .setTitle('🎵 لوحة تحكم بوت الموسيقى')
            .setDescription('استخدم الأزرار أدناه للتحكم في الموسيقى')
            .setColor('#667eea')
            .addFields(
                { name: '🎵 الأغنية الحالية', value: currentSong ? currentSong.title : 'لا توجد', inline: true },
                { name: '📊 حالة التشغيل', value: isPlaying ? '▶️ قيد التشغيل' : '⏸️ متوقف', inline: true },
                { name: '📋 عدد الأغاني', value: queue.length.toString(), inline: true }
            )
            .setThumbnail(currentSong ? currentSong.thumbnail : 'https://cdn.discordapp.com/attachments/123456789/123456789/music-icon.png')
            .setFooter({ text: 'استخدم الأزرار للتحكم في الموسيقى' })
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play_pause')
                    .setLabel(isPlaying ? '⏸️ إيقاف' : '▶️ تشغيل')
                    .setStyle(isPlaying ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('⏭️ تخطي')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('⏹️ إيقاف')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('queue')
                    .setLabel('📋 القائمة')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_song')
                    .setLabel('➕ إضافة أغنية')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('add_playlist')
                    .setLabel('📋 إضافة قائمة')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('refresh')
                    .setLabel('🔄 تحديث')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('web_dashboard')
                    .setLabel('🖥️ لوحة الويب')
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`)
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [row1, row2] 
        });
    }
});

// معالج الأزرار التفاعلية
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const { customId } = interaction;
        
        if (customId === 'play_pause') {
            if (!isPlaying) {
                if (queue.length > 0) {
                    const song = queue.shift();
                    currentSong = song;
                    isPlaying = true;
                    await playSong(null, song);
                    await interaction.reply({ content: 'تم تشغيل الأغنية!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'لا توجد أغاني في القائمة!', ephemeral: true });
                }
            } else {
                audioPlayer.pause();
                await interaction.reply({ content: 'تم إيقاف التشغيل مؤقتاً!', ephemeral: true });
            }
        }
        
        if (customId === 'skip') {
            if (isPlaying) {
                audioPlayer.stop();
                await interaction.reply({ content: 'تم تخطي الأغنية!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'لا يوجد أغنية قيد التشغيل!', ephemeral: true });
            }
        }
        
        if (customId === 'stop') {
            if (isPlaying) {
                queue = [];
                audioPlayer.stop();
                isPlaying = false;
                currentSong = null;
                await interaction.reply({ content: 'تم إيقاف التشغيل وإفراغ القائمة!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'لا يوجد تشغيل!', ephemeral: true });
            }
        }
        
        if (customId === 'queue') {
            if (queue.length === 0 && !currentSong) {
                await interaction.reply({ content: 'القائمة فارغة!', ephemeral: true });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('📋 قائمة الأغاني')
                .setColor('#0099ff');
            
            if (currentSong) {
                embed.addFields({ name: '🎵 الآن', value: currentSong.title, inline: false });
            }
            
            if (queue.length > 0) {
                const queueList = queue.slice(0, 10).map((song, index) => 
                    `${index + 1}. ${song.title}`
                ).join('\n');
                embed.addFields({ name: '⏭️ التالية', value: queueList, inline: false });
            }
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (customId === 'add_song') {
            const embed = new EmbedBuilder()
                .setTitle('➕ إضافة أغنية')
                .setDescription('استخدم الأمر `/play <رابط أو اسم الأغنية>` لإضافة أغنية جديدة')
                .setColor('#00ff00')
                .addFields(
                    { name: 'مثال:', value: '`/play https://www.youtube.com/watch?v=...`', inline: false },
                    { name: 'أو:', value: '`/play اسم الأغنية`', inline: false }
                );
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (customId === 'add_playlist') {
            const embed = new EmbedBuilder()
                .setTitle('📋 إضافة قائمة تشغيل')
                .setDescription('استخدم الأمر `/playlist <رابط القائمة>` لإضافة قائمة تشغيل')
                .setColor('#ff9900')
                .addFields(
                    { name: 'مثال:', value: '`/playlist https://www.youtube.com/playlist?list=...`', inline: false }
                );
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (customId === 'refresh') {
            const embed = new EmbedBuilder()
                .setTitle('🎵 لوحة تحكم بوت الموسيقى')
                .setDescription('استخدم الأزرار أدناه للتحكم في الموسيقى')
                .setColor('#667eea')
                .addFields(
                    { name: '🎵 الأغنية الحالية', value: currentSong ? currentSong.title : 'لا توجد', inline: true },
                    { name: '📊 حالة التشغيل', value: isPlaying ? '▶️ قيد التشغيل' : '⏸️ متوقف', inline: true },
                    { name: '📋 عدد الأغاني', value: queue.length.toString(), inline: true }
                )
                .setThumbnail(currentSong ? currentSong.thumbnail : 'https://cdn.discordapp.com/attachments/123456789/123456789/music-icon.png')
                .setFooter({ text: 'استخدم الأزرار للتحكم في الموسيقى' })
                .setTimestamp();

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_pause')
                        .setLabel(isPlaying ? '⏸️ إيقاف' : '▶️ تشغيل')
                        .setStyle(isPlaying ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('⏭️ تخطي')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('⏹️ إيقاف')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('queue')
                        .setLabel('📋 القائمة')
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('add_song')
                        .setLabel('➕ إضافة أغنية')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('add_playlist')
                        .setLabel('📋 إضافة قائمة')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('refresh')
                        .setLabel('🔄 تحديث')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('web_dashboard')
                        .setLabel('🖥️ لوحة الويب')
                        .setStyle(ButtonStyle.Link)
                        .setURL(process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`)
                );

            await interaction.update({ 
                embeds: [embed], 
                components: [row1, row2] 
            });
        }
    }
});

// API Routes للوحة التحكم
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// إضافة أغنية من لوحة التحكم
app.post('/api/add-song', async (req, res) => {
    try {
        const { url } = req.body;
        const song = await searchSong(url);
        
        if (!song) {
            return res.status(400).json({ error: 'لم يتم العثور على الأغنية' });
        }
        
        if (isPlaying) {
            queue.push(song);
            res.json({ message: 'تم إضافة الأغنية للقائمة', song });
        } else {
            currentSong = song;
            isPlaying = true;
            // تشغيل الأغنية إذا كان البوت في قناة صوتية
            if (currentGuild && currentChannel) {
                await playSong(null, song);
            }
            res.json({ message: 'تم تشغيل الأغنية', song });
        }
    } catch (error) {
        console.error('خطأ في إضافة الأغنية:', error);
        res.status(500).json({ error: 'حدث خطأ في إضافة الأغنية' });
    }
});

// إضافة قائمة تشغيل
app.post('/api/add-playlist', async (req, res) => {
    try {
        const { url } = req.body;
        // هذا مثال بسيط - في الواقع تحتاج مكتبة خاصة لقوائم التشغيل
        res.json({ message: 'تم إضافة قائمة التشغيل (ميزة قيد التطوير)' });
    } catch (error) {
        console.error('خطأ في إضافة قائمة التشغيل:', error);
        res.status(500).json({ error: 'حدث خطأ في إضافة قائمة التشغيل' });
    }
});

// الحصول على قائمة الأغاني
app.get('/api/queue', (req, res) => {
    res.json({
        queue: queue,
        currentSong: currentSong,
        isPlaying: isPlaying,
        isConnected: client.isReady()
    });
});

// تخطي إلى أغنية معينة
app.post('/api/skip-to', (req, res) => {
    try {
        const { index } = req.body;
        
        if (index < 0 || index >= queue.length) {
            return res.status(400).json({ error: 'فهرس غير صحيح' });
        }
        
        // نقل الأغنية المحددة إلى بداية القائمة
        const song = queue.splice(index, 1)[0];
        queue.unshift(song);
        
        // تخطي الأغنية الحالية
        if (isPlaying) {
            audioPlayer.stop();
        }
        
        res.json({ message: 'تم التخطي بنجاح' });
    } catch (error) {
        console.error('خطأ في التخطي:', error);
        res.status(500).json({ error: 'حدث خطأ في التخطي' });
    }
});

// حذف أغنية من القائمة
app.post('/api/remove-from-queue', (req, res) => {
    try {
        const { index } = req.body;
        
        if (index < 0 || index >= queue.length) {
            return res.status(400).json({ error: 'فهرس غير صحيح' });
        }
        
        const removedSong = queue.splice(index, 1)[0];
        res.json({ message: 'تم حذف الأغنية', song: removedSong });
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        res.status(500).json({ error: 'حدث خطأ في الحذف' });
    }
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`لوحة التحكم متاحة على: http://localhost:${PORT}`);
});

// تسجيل الدخول
client.login(config.DISCORD_TOKEN);
