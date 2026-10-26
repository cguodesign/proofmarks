import { chineseGbNotationPack } from "@proofmarks/notations/gb";
import { taiwanCns3927NotationPack } from "@proofmarks/notations/cns3927";
import { englishUsNotationPack } from "@proofmarks/notations/en-us";
import { japaneseJisNotationPack } from "@proofmarks/notations/jis";
import { koreanKsNotationPack } from "@proofmarks/notations/ks";
import type { NotationPack } from "./types";

export const jis = japaneseJisNotationPack as unknown as NotationPack;
export const gb = chineseGbNotationPack as unknown as NotationPack;
export const cns3927 = taiwanCns3927NotationPack as unknown as NotationPack;
export const ks = koreanKsNotationPack as unknown as NotationPack;
export const enUS = englishUsNotationPack as unknown as NotationPack;

export type { NotationPack } from "./types";
