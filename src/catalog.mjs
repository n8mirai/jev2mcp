// Example catalog. Turn off any plugin that is not installed in your account.
// Availability is confirmed by the user; browser attachment also requires a native picker match.
export const catalog = [
  {
    id: 'gmail',
    name: 'Gmail',
    mention: 'Gmail',
    description:
      'Find and read the user’s email and threads, search inbox and draft email. Not general writing or explaining email.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    mention: 'Google Drive',
    description:
      'Find, read, create and edit connected Google Drive files, Google Docs, Sheets and Slides.',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    mention: 'Google Calendar',
    description:
      'Read actual calendar events and availability, create or change calendar events. Not general scheduling advice.',
  },
  {
    id: 'pantry',
    name: 'Pantry',
    mention: 'Pantry',
    description:
      'Read the user’s actual food inventory, including quantities and items running low. Use when the user is unsure what food is already at home, wants to avoid duplicate purchases, or needs a meal plan or restock based on current stock.',
  },
  {
    id: 'instacart',
    name: 'Instacart',
    mention: 'Instacart',
    description:
      'Search available groceries and create or update an Instacart shopping cart for the user to review before payment. Use when the user wants needed groceries queued or ready to check, including items missing from their pantry. Adding to a cart is not placing an order.',
  },
  {
    id: 'personal-vault',
    name: 'Personal Vault',
    mention: 'Personal Vault',
    description:
      'Read or update the user’s personal Markdown notes, ongoing plans and adopted decisions in their vault.',
  },
  {
    id: 'sites',
    name: 'Sites',
    mention: 'Sites',
    description:
      'Build, edit and host a complete website or interactive web app. Not explaining HTML or answering coding questions.',
  },
];
