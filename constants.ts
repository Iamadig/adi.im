
import { SectionType, NavItem, Quote, Craft, Thought, RecommendationSection } from './types';
import { User, MessageSquare, Quote as QuoteIcon, Palette, Star } from 'lucide-react';

// --- NOTION CONFIGURATION ---
export const NOTION_CONFIG = {
  API_KEY: process.env.REACT_APP_NOTION_KEY || '', 
  DATABASE_IDS: {
    THOUGHTS: process.env.REACT_APP_NOTION_THOUGHTS_DB || '',
    QUOTES: process.env.REACT_APP_NOTION_QUOTES_DB || '',
    CRAFTS: process.env.REACT_APP_NOTION_CRAFTS_DB || '',
  },
  PAGE_IDS: {
    ABOUT: process.env.REACT_APP_NOTION_ABOUT_PAGE || '',
    RECOMMENDATIONS: process.env.REACT_APP_NOTION_RECS_PAGE || '',
  }
};

export const NAV_ITEMS: NavItem[] = [
  { id: SectionType.ABOUT, label: 'About Me', icon: User },
  { id: SectionType.THOUGHTS, label: 'Thoughts', icon: MessageSquare },
  { id: SectionType.QUOTES, label: 'Quotes', icon: QuoteIcon },
  { id: SectionType.CRAFTS, label: 'Crafts', icon: Palette },
  { id: SectionType.RECOMMENDATIONS, label: 'Recommendations', icon: Star },
];

export const ABOUT_ME_TEXT = `I'm Adi. I'm a Design Engineer based in New York.

I sit at the intersection of design and engineering. I care deeply about building high-quality software that feels tangible and handcrafted. I believe that the best software is built by people who understand both the pixels and the code.

Currently, I'm building the future of creative tools. Before that, I worked on design systems and interaction design at various startups.

I enjoy photography, mechanical keyboards, and exploring the city.`;

// Structured Data for Recommendations to allow Inline Editing
export const RECOMMENDATION_SECTIONS: RecommendationSection[] = [
  {
    id: 'books',
    title: 'Books',
    items: [
      'The Design of Everyday Things - Don Norman',
      'Creative Selection - Ken Kocienda',
      'Shape Up - Ryan Singer'
    ]
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      'Linear - Issue tracking',
      'Raycast - Mac launcher',
      'Figma - Interface design'
    ]
  },
  {
    id: 'movies',
    title: 'Movies',
    items: [
      'Jiro Dreams of Sushi',
      'Her',
      'Ex Machina'
    ]
  }
];

export const INITIAL_THOUGHTS: Thought[] = [
  {
    id: '101',
    title: 'On Craft',
    date: 'Oct 12, 2023',
    content: 'Craft is the difference between "good enough" and "magical". It\'s the invisible details—the spring physics of a button, the easing of a transition, the micro-copy that makes you smile. In a world of standardized components, craft is our rebellion.',
    tags: ['Design', 'Philosophy']
  },
  {
    id: '102',
    title: 'The Speed of Thought',
    date: 'Sep 04, 2023',
    content: 'Tools should move at the speed of thought. Latency isn\'t just a performance metric; it\'s a cognitive barrier. When a tool responds instantly, it disappears, leaving you alone with your ideas.',
    tags: ['Performance', 'DX']
  },
  {
    id: '103',
    title: 'Simplicity is hard',
    date: 'Aug 15, 2023',
    content: 'Making something simple is incredibly complex. You have to understand the problem so deeply that you can abstract away the difficulty for the user. Simple isn\'t minimal; simple is clear.',
    tags: ['Minimalism']
  },
  {
    id: '104',
    title: 'The Infinite Canvas',
    date: 'July 20, 2023',
    content: `The web is an infinite canvas, yet we often treat it like a series of A4 pages. We constrain our ideas into rigid boxes, defined by viewports and fold lines. But the most exciting interfaces are the ones that break these boundaries.

Consider the history of the scroll. It wasn't always a given. Early hypertext systems often relied on pagination. The continuous scroll introduced a fluidity to information consumption that we now take for granted. It turned reading into a journey rather than a series of discrete steps.

When we design for the infinite canvas, we have to think about pacing. Just like a movie director controls the flow of a scene, a designer controls the flow of information. White space isn't just empty space; it's time. It's a breath. It allows the user to process what they've just seen before moving on to the next idea.

We're seeing a resurgence of spatial interfaces—tools like Figma, Miro, and endless whiteboards. These tools embrace the infinite. They allow us to map out our thoughts non-linearly. This is a fundamental shift in how we interact with computers. We're moving away from file cabinets and towards workbenches.

However, with great power comes great responsibility. An infinite canvas can be overwhelming. Without structure, it becomes chaos. The challenge for modern interface design is to provide the freedom of the infinite while maintaining the comfort of constraints. We need landmarks. We need maps. We need a way to find our way home.

As we build the next generation of tools, we should ask ourselves: Are we building pages, or are we building worlds? The screen is just a window. The content continues forever.`,
    tags: ['Design', 'Longform', 'Philosophy']
  }
];

export const INITIAL_QUOTES: Quote[] = [
  { id: '1', text: "The details are not the details. They make the design.", author: "Charles Eames" },
  { id: '2', text: "Good design is as little design as possible.", author: "Dieter Rams" },
  { id: '3', text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
];

export const INITIAL_CRAFTS: Craft[] = [
  { id: '1', title: "Rauno Freiberg", url: "https://rauno.me", domain: "rauno.me" },
  { id: '2', title: "Paco Coursey", url: "https://paco.me", domain: "paco.me" },
  { id: '3', title: "Emil Kowalski", url: "https://emilkowal.ski", domain: "emilkowal.ski" },
  { id: '4', title: "Family", url: "https://family.co", domain: "family.co" },
];
