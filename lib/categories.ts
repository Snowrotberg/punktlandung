import type { LocationCategory } from "@/types/game";

export type CategoryOption = {
  id: string;
  selectableId?: LocationCategory;
  title: string;
  short: string;
  tag: string;
  icon: string;
  homeIconClass: string;
  lobbyIconClass: string;
  disabled?: boolean;
};

export const categoryOptions: CategoryOption[] = [
  {
    id: "mixed",
    selectableId: "mixed",
    title: "Gemischt",
    short: "Alles zufällig, alles möglich.",
    tag: "01",
    icon: "/category-icons/mixed-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "landmarks",
    selectableId: "landmarks",
    title: "Wahrzeichen",
    short: "Weißt du, wo sie sich befinden?",
    tag: "02",
    icon: "/category-icons/landmarks-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "cities",
    selectableId: "cities",
    title: "Städte",
    short: "Erkennst du die Stadt?",
    tag: "03",
    icon: "/category-icons/cities-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "landscapes",
    selectableId: "landscapes",
    title: "Landschaften",
    short: "Wo liegt diese Naturkulisse?",
    tag: "04",
    icon: "/category-icons/landscapes-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "flags",
    selectableId: "flags",
    title: "Flaggen",
    short: "Finde das Land zur Flagge.",
    tag: "05",
    icon: "/category-icons/flags-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "capitals",
    selectableId: "capitals",
    title: "Hauptstädte",
    short: "Kennst du das passende Land?",
    tag: "06",
    icon: "/category-icons/capitals-trim.png",
    homeIconClass: "max-h-[58px] max-w-[82px]",
    lobbyIconClass: "max-h-[74px] max-w-[92px] sm:max-h-[88px] sm:max-w-[124px]"
  },
  {
    id: "satellite-preview",
    title: "Satellit",
    short: "Luftbilder und Karten von oben.",
    tag: "07",
    icon: "/category-icons/satellite-preview.png",
    homeIconClass: "max-h-[76px] max-w-[112px]",
    lobbyIconClass: "max-h-[88px] max-w-[132px] sm:max-h-[104px] sm:max-w-[154px]",
    disabled: true
  },
  {
    id: "streetview-preview",
    title: "Street View",
    short: "Straßen direkt aus Augenhöhe.",
    tag: "08",
    icon: "/category-icons/streetview-preview.png",
    homeIconClass: "max-h-[76px] max-w-[112px]",
    lobbyIconClass: "max-h-[88px] max-w-[132px] sm:max-h-[104px] sm:max-w-[154px]",
    disabled: true
  }
];
