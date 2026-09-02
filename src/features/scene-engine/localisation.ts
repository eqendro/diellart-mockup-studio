export const sceneMessages = {
  en: { productView: "Product", mainDish: "Main Dish", dessert: "Dessert & Coffee", preview: "Preview", yourDesign: "Your design", digitalProof: "Digital proof", lifestylePreviews: "Your previews", lifestyleHeading: "See your design in every setting.", lifestyleDescription: "Adjust your design in Product, then review it in each setting.", previewUnavailable: "Preview unavailable" },
  sq: { productView: "Produkti", mainDish: "Pjata Kryesore", dessert: "Ëmbëlsirë & Kafe", preview: "Parapamje", yourDesign: "Dizajni juaj", digitalProof: "Prova Dixhitale", lifestylePreviews: "Parapamjet tuaja", lifestyleHeading: "Shikoni dizajnin tuaj në çdo ambient.", lifestyleDescription: "Rregulloni dizajnin te Produkti, pastaj shikojeni në çdo ambient.", previewUnavailable: "Parapamja nuk është e disponueshme" },
} as const;

export type SceneLocale = keyof typeof sceneMessages;
export function sceneText(locale: SceneLocale = "en"): Readonly<Record<string, string>> { return sceneMessages[locale]; }
