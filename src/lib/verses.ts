// Scripture for the app. All references are quoted from the King James Version.

export interface Verse {
  text: string;
  ref: string;
}

// Rotating "Verse of the day" — worship, music, and the heart behind both.
export const DAILY_VERSES: Verse[] = [
  { text: "Sing unto him a new song; play skilfully with a loud noise.", ref: "Psalm 33:3" },
  { text: "Serve the LORD with gladness: come before his presence with singing.", ref: "Psalm 100:2" },
  { text: "O sing unto the LORD a new song: sing unto the LORD, all the earth.", ref: "Psalm 96:1" },
  { text: "Let every thing that hath breath praise the LORD. Praise ye the LORD.", ref: "Psalm 150:6" },
  { text: "Let the word of Christ dwell in you richly in all wisdom; teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.", ref: "Colossians 3:16" },
  { text: "Speaking to yourselves in psalms and hymns and spiritual songs, singing and making melody in your heart to the Lord.", ref: "Ephesians 5:19" },
  { text: "Make a joyful noise unto the LORD, all the earth: make a loud noise, and rejoice, and sing praise.", ref: "Psalm 98:4" },
  { text: "By him therefore let us offer the sacrifice of praise to God continually, that is, the fruit of our lips giving thanks to his name.", ref: "Hebrews 13:15" },
  { text: "And he hath put a new song in my mouth, even praise unto our God: many shall see it, and fear, and shall trust in the LORD.", ref: "Psalm 40:3" },
  { text: "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.", ref: "Zephaniah 3:17" },
  { text: "My heart is fixed, O God, my heart is fixed: I will sing and give praise.", ref: "Psalm 57:7" },
  { text: "God is a Spirit: and they that worship him must worship him in spirit and in truth.", ref: "John 4:24" },
  { text: "O magnify the LORD with me, and let us exalt his name together.", ref: "Psalm 34:3" },
  { text: "I was glad when they said unto me, Let us go into the house of the LORD.", ref: "Psalm 122:1" },
  { text: "Sing unto him, sing psalms unto him, talk ye of all his wondrous works.", ref: "1 Chronicles 16:9" },
  { text: "Praise ye the LORD: for it is good to sing praises unto our God; for it is pleasant; and praise is comely.", ref: "Psalm 147:1" },
];

export function verseOfTheDay(date = new Date()): Verse {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return DAILY_VERSES[day % DAILY_VERSES.length];
}
