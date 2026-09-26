// Writes public/sidestore.json: a SideStore (AltStore-format) source listing the latest .ipa.
// Add https://hugos-piano.vercel.app/sidestore.json once in SideStore → Sources; new builds then
// appear as an Update in SideStore.
import { writeFileSync } from 'node:fs';

const [version, build, file, size] = process.argv.slice(2);
const site = 'https://hugos-piano.vercel.app';
const today = new Date().toISOString().slice(0, 10);

const source = {
  name: "Hugo's Piano",
  identifier: 'com.hugoleonor.hugospiano.source',
  subtitle: 'Your songs, part by part.',
  iconURL: `${site}/icons/icon-512.png`,
  website: site,
  tintColor: '#f25c08',
  apps: [
    {
      name: "Hugo's Piano",
      bundleIdentifier: 'com.hugoleonor.hugospiano',
      developerName: 'Hugo Leonor',
      subtitle: 'Learn your songs part by part.',
      localizedDescription: 'Falling notes or the score, a course for every song, and your keyboard by cable, Bluetooth or the microphone.',
      iconURL: `${site}/icons/icon-512.png`,
      tintColor: '#f25c08',
      category: 'entertainment',
      screenshotURLs: [],
      versions: [
        {
          version,
          buildVersion: String(build),
          date: today,
          localizedDescription: `Version ${version} (build ${build}).`,
          downloadURL: `${site}/ipa/${file}`,
          size: Number(size),
          minOSVersion: '15.0',
        },
      ],
      appPermissions: {
        entitlements: [],
        privacy: {
          NSMicrophoneUsageDescription: "Hugo's Piano listens to your piano to check the notes you play.",
          NSBluetoothAlwaysUsageDescription: 'Connect a Bluetooth MIDI keyboard.',
        },
      },
    },
  ],
  news: [],
};

writeFileSync('public/sidestore.json', JSON.stringify(source, null, 2) + '\n');
console.log(`public/sidestore.json → ${file} (${version} build ${build})`);
