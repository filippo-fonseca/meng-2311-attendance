// lib/passwords.ts
export const PASSWORDS = [
    "apple", "banana", "cherry", "date", "elderberry",
    "fig", "grape", "honeydew", "kiwi", "lemon",
    "mango", "nectarine", "orange", "peach", "quince",
    "raspberry", "strawberry", "tangerine", "watermelon", "avocado",
    "blueberry", "cantaloupe", "dragonfruit", "elderflower", "guava",
    "jackfruit", "kumquat", "lychee", "mulberry", "papaya",
    "pineapple", "plum", "pomegranate", "soursop", "tomato",
    "ugli", "vanilla", "wolfberry", "xigua", "yellowpassion",
    "zucchini", "acai", "blackberry", "cranberry", "durian",
    "feijoa", "gooseberry", "huckleberry", "ilama", "jambul"
  ];
  
  export const getTodaysPasswordIndex = (): number => {
    const now = new Date();
    const startDate = new Date('2024-01-01'); // Adjust based on your semester start
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only count Mon, Wed, Fri (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    let classDays = 0;
    for (let i = 0; i < daysSinceStart; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const day = date.getDay();
      if (day === 1 || day === 3 || day === 5) classDays++;
    }
    
    return classDays % PASSWORDS.length;
  };
  
  export const getTodaysPassword = (): string => {
    return PASSWORDS[getTodaysPasswordIndex()];
  };
  
  export const isAttendanceOpen = (): boolean => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    
    // Only available on Mon, Wed, Fri (1, 3, 5)
    if (day !== 1 && day !== 3 && day !== 5) return false;
    
    // Available until 12:00 PM
    return hour < 14 || (hour === 14 && minutes === 0);
  };