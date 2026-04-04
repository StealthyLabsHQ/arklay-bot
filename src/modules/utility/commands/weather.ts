import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandDef } from '../../../types';

interface WeatherData {
  current: { temperature_2m: number; wind_speed_10m: number; weather_code: number; relative_humidity_2m: number };
  current_units: { temperature_2m: string };
}

interface GeoResult {
  results?: Array<{ name: string; country: string; latitude: number; longitude: number }>;
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
};

const weather: CommandDef = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for a city')
    .addStringOption((opt) => opt.setName('city').setDescription('City name').setRequired(true)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const city = interaction.options.getString('city', true);

    try {
      const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const geoData = await geoRes.json() as GeoResult;

      if (!geoData.results?.length) {
        await interaction.editReply(`City **${city}** not found.`);
        return;
      }

      const loc = geoData.results[0]!;
      const wxRes  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m`);
      const wxData = await wxRes.json() as WeatherData;

      const wx = wxData.current;
      const desc = WEATHER_CODES[wx.weather_code] ?? 'Unknown';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${loc.name}, ${loc.country}`)
        .setDescription(`**${desc}**`)
        .addFields(
          { name: 'Temperature', value: `${wx.temperature_2m}${wxData.current_units.temperature_2m}`, inline: true },
          { name: 'Wind',        value: `${wx.wind_speed_10m} km/h`, inline: true },
          { name: 'Humidity',    value: `${wx.relative_humidity_2m}%`, inline: true },
        )
        .setFooter({ text: 'Data from Open-Meteo' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Could not fetch weather data.');
    }
  },
};

export default weather;
