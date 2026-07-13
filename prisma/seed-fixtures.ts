/**
 * Seed fixtures — DATA ONLY.
 *
 * Zero imports, zero runtime behaviour. Every date is an integer day offset
 * from the moment the seed runs (0 = today, negative = the past), so the
 * fixture is valid whenever it is executed. The builder in `seed.ts` turns
 * these offsets into rows.
 *
 * Step 7's engine tests import this module: scenario tuning must mean editing
 * numbers here, never editing logic there.
 */

export const DEMO_EMAIL = "demo@pacekeeper.dev";
export const DEMO_PASSWORD = "pacekeeper-demo";
export const DEMO_NAME = "Demo Student";

/** IANA zone the demo account's day boundaries are computed in (§6 `?tz=`). */
export const DEMO_TIMEZONE = "Asia/Kolkata";

/** Superseded by the demo account; its row is removed on every seed run. */
export const TEST_USER_EMAIL = "test@pacekeeper.dev";

export type FixtureQuestion =
  | { type: "MCQ"; prompt: string; options: string[]; correctIndex: number }
  | { type: "FLASHCARD"; prompt: string; back: string };

export type FixtureAttempts = {
  /** Day the topic was first studied — every question gets one attempt. */
  introducedDay: number;
  /** Later review sessions — every question is re-attempted on each. */
  reviewDays: number[];
  /** Correct-rate targeted on the first session. */
  firstAccuracy: number;
  /** Correct-rate the learner converges to; the builder ramps between the two. */
  steadyAccuracy: number;
};

export type FixtureTopic = {
  title: string;
  material: string;
  /** Day this topic is scheduled for in plan version 0. */
  plannedDay: number;
  questions: FixtureQuestion[];
  /** Omitted = never introduced (no attempts, readiness 0). */
  attempts?: FixtureAttempts;
};

export type FixtureModule = {
  title: string;
  topics: FixtureTopic[];
};

export type FixtureGoal = {
  key: "A" | "B" | "C";
  title: string;
  /** Days from today to the exam. */
  examDay: number;
  dailyNewTopicCap: number;
  bufferDays: number;
  /**
   * Days on which the learner studied nothing: the builder drops any attempt
   * that would land here. This is how "missed a day" / "missed a week" is
   * expressed declaratively rather than by hand-editing review lists.
   */
  skipDays: number[];
  modules: FixtureModule[];
};

/* ────────────────────────────────────────────────────────────────────────────
 * GOAL A — Human Biology Final
 *
 * TARGET REGIME: ON_PACE (silent redistribution — the miss is absorbed with
 * no visible replan).
 *
 * §5.5 arithmetic:
 *   totalActiveTopics = 9   examDay = +21   dailyNewTopicCap = 5   bufferDays = 2
 *   plan v0 spans day −30 … day +14  →  originalPlanLength = 45 days
 *   baselineRate = 9 / 45            = 0.200 topics/day
 *   ON_PACE threshold = 0.200 × 1.25 = 0.250
 *
 *   daysUsable   = (21 − 0) − 2 = 19
 *   introduced   = 6 (the six topics planned on/before today)
 *   remaining    = 9 − 6 = 3
 *   requiredRate = 3 / 19 = 0.158
 *
 *   0.158 ≤ 0.250  →  ON_PACE ✓
 *
 * WHY THE MISS IS ABSORBED SILENTLY: the learner skipped day −5 entirely (see
 * skipDays) and caught up the next day. Even in the counterfactual where that
 * topic had NOT been caught up, remaining = 4 and requiredRate = 4 / 19 = 0.211,
 * which is still ≤ 0.225. The 1.25 tolerance is exactly what keeps one lost day
 * from flipping the regime — the engine redistributes silently and the user is
 * never shown a replan. Margin holds under an inclusive daysUsable reading too
 * (3/20 = 0.150, 4/20 = 0.200).
 *
 * DEMO VIDEO: the healthy case. Dashboard with high readiness bars, no banner,
 * a normal Today list of reviews. This is the baseline the other two goals are
 * read against.
 * ──────────────────────────────────────────────────────────────────────────── */
const GOAL_A: FixtureGoal = {
  key: "A",
  title: "Human Biology Final",
  examDay: 21,
  dailyNewTopicCap: 5,
  bufferDays: 2,
  skipDays: [-5],
  modules: [
    {
      title: "Cells & Tissues",
      topics: [
        {
          title: "Cell structure and organelles",
          material:
            "Eukaryotic cells compartmentalise their chemistry into membrane-bound organelles. The nucleus stores DNA, mitochondria produce ATP by oxidative phosphorylation, and the rough endoplasmic reticulum studded with ribosomes synthesises proteins destined for secretion. The Golgi apparatus then modifies, sorts and packages those proteins into vesicles.",
          plannedDay: -30,
          attempts: {
            introducedDay: -30,
            reviewDays: [-29, -27, -23, -16, -9, -2],
            firstAccuracy: 0.75,
            steadyAccuracy: 0.92,
          },
          questions: [
            {
              type: "MCQ",
              prompt:
                "Which organelle is the primary site of ATP production in a eukaryotic cell?",
              options: [
                "Mitochondrion",
                "Golgi apparatus",
                "Lysosome",
                "Smooth endoplasmic reticulum",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Rough endoplasmic reticulum is distinguished from smooth ER by the presence of which structure on its surface?",
              options: ["Ribosomes", "Centrioles", "Cilia", "Peroxisomes"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which organelle modifies, sorts and packages proteins into vesicles after they leave the ER?",
              options: [
                "Golgi apparatus",
                "Nucleolus",
                "Mitochondrion",
                "Ribosome",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is the function of the lysosome?",
              back: "It digests worn-out organelles, macromolecules and engulfed material using acidic hydrolytic enzymes that work best at roughly pH 5.",
            },
            {
              type: "FLASHCARD",
              prompt: "What is the fluid mosaic model?",
              back: "The model of the plasma membrane as a fluid phospholipid bilayer in which proteins, cholesterol and glycolipids are embedded and free to move laterally.",
            },
          ],
        },
        {
          title: "Membrane transport",
          material:
            "Substances cross the plasma membrane by passive routes that need no ATP (simple diffusion, facilitated diffusion through channels, osmosis) or by active transport, which spends ATP to move solutes against their concentration gradient. The sodium-potassium pump is the canonical active transporter.",
          plannedDay: -25,
          attempts: {
            introducedDay: -25,
            reviewDays: [-24, -22, -18, -11, -4],
            firstAccuracy: 0.72,
            steadyAccuracy: 0.9,
          },
          questions: [
            {
              type: "MCQ",
              prompt:
                "The sodium-potassium pump moves ions in which ratio per ATP hydrolysed?",
              options: [
                "3 Na⁺ out, 2 K⁺ in",
                "2 Na⁺ out, 3 K⁺ in",
                "1 Na⁺ out, 1 K⁺ in",
                "3 Na⁺ in, 2 K⁺ out",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "A red blood cell placed in a hypotonic solution will most likely:",
              options: [
                "Swell and possibly lyse",
                "Shrink and crenate",
                "Remain unchanged",
                "Actively pump water outward",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which process requires no metabolic energy from the cell?",
              options: [
                "Facilitated diffusion",
                "Primary active transport",
                "Exocytosis",
                "Phagocytosis",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Define osmosis.",
              back: "The net passive movement of water across a selectively permeable membrane from a region of higher water potential (lower solute concentration) to one of lower water potential.",
            },
            {
              type: "FLASHCARD",
              prompt:
                "How does secondary active transport differ from primary active transport?",
              back: "Primary active transport hydrolyses ATP directly. Secondary active transport spends no ATP itself — it rides the electrochemical gradient that primary transport already established, as in the sodium-glucose cotransporter.",
            },
          ],
        },
        {
          title: "Tissue types",
          material:
            "The four primary tissue types are epithelial, connective, muscle and nervous. Epithelium covers surfaces and lines cavities; connective tissue supports and binds; muscle contracts; nervous tissue conducts electrical signals.",
          plannedDay: -20,
          attempts: {
            introducedDay: -20,
            reviewDays: [-19, -17, -13, -6, -1],
            firstAccuracy: 0.8,
            steadyAccuracy: 0.94,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "Which of the following is NOT a primary tissue type?",
              options: [
                "Cartilaginous tissue",
                "Epithelial tissue",
                "Muscle tissue",
                "Nervous tissue",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which muscle type is striated, multinucleated and under voluntary control?",
              options: [
                "Skeletal muscle",
                "Cardiac muscle",
                "Smooth muscle",
                "Myoepithelium",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Simple squamous epithelium lining the alveoli is well suited to its role because it is:",
              options: [
                "A single thin layer, minimising diffusion distance",
                "Multi-layered and keratinised for protection",
                "Ciliated for moving mucus",
                "Densely packed with secretory goblet cells",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What distinguishes cardiac muscle from skeletal muscle?",
              back: "Cardiac muscle is striated like skeletal muscle but its cells are branched, usually uninucleate, joined by intercalated discs with gap junctions, and it contracts involuntarily.",
            },
            {
              type: "FLASHCARD",
              prompt: "Name the two cell types of nervous tissue.",
              back: "Neurons, which generate and conduct action potentials, and glial (neuroglial) cells, which support, insulate and nourish them.",
            },
          ],
        },
      ],
    },
    {
      title: "Cardiovascular System",
      topics: [
        {
          title: "Heart anatomy",
          material:
            "The heart has four chambers. Deoxygenated blood enters the right atrium, passes the tricuspid valve into the right ventricle, and is pumped to the lungs. Oxygenated blood returns to the left atrium, crosses the mitral valve into the left ventricle, and is ejected into the aorta.",
          plannedDay: -15,
          attempts: {
            // A review would have fallen on day −5; skipDays drops it. This is
            // the single missed day the ON_PACE math above absorbs.
            introducedDay: -15,
            reviewDays: [-14, -12, -8, -5, -1],
            firstAccuracy: 0.74,
            steadyAccuracy: 0.9,
          },
          questions: [
            {
              type: "MCQ",
              prompt:
                "Which valve separates the left atrium from the left ventricle?",
              options: [
                "Mitral (bicuspid) valve",
                "Tricuspid valve",
                "Aortic valve",
                "Pulmonary valve",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The left ventricle wall is thicker than the right because it:",
              options: [
                "Pumps blood against the higher resistance of the systemic circuit",
                "Holds a much larger volume of blood",
                "Contracts more times per minute",
                "Contains no cardiac muscle",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Which vessel carries deoxygenated blood away from the heart?",
              options: [
                "Pulmonary artery",
                "Pulmonary vein",
                "Aorta",
                "Carotid artery",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What do the coronary arteries supply?",
              back: "The myocardium itself. They branch from the base of the aorta just above the aortic valve; their occlusion causes myocardial infarction.",
            },
            {
              type: "FLASHCARD",
              prompt: "Trace the path of blood through the right side of the heart.",
              back: "Vena cavae → right atrium → tricuspid valve → right ventricle → pulmonary valve → pulmonary arteries → lungs.",
            },
          ],
        },
        {
          title: "The cardiac cycle and ECG",
          material:
            "One cardiac cycle comprises atrial systole, ventricular systole and diastole. The sinoatrial node sets the rhythm. On an ECG the P wave marks atrial depolarisation, the QRS complex ventricular depolarisation, and the T wave ventricular repolarisation.",
          plannedDay: -10,
          attempts: {
            introducedDay: -10,
            reviewDays: [-9, -7, -3, 0],
            firstAccuracy: 0.7,
            steadyAccuracy: 0.88,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "The QRS complex on an ECG represents:",
              options: [
                "Ventricular depolarisation",
                "Atrial depolarisation",
                "Ventricular repolarisation",
                "Atrial repolarisation",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Which structure is the heart's natural pacemaker?",
              options: [
                "The sinoatrial node",
                "The atrioventricular node",
                "The bundle of His",
                "The Purkinje fibres",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Cardiac output is correctly calculated as:",
              options: [
                "Heart rate × stroke volume",
                "Heart rate ÷ stroke volume",
                "Stroke volume × blood pressure",
                "Heart rate × blood pressure",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What causes the first heart sound ('lub')?",
              back: "Closure of the atrioventricular valves (mitral and tricuspid) at the start of ventricular systole.",
            },
            {
              type: "FLASHCARD",
              prompt: "Why is there a delay at the atrioventricular node?",
              back: "The roughly 0.1 s delay lets the atria finish contracting and fully empty into the ventricles before ventricular contraction begins.",
            },
          ],
        },
        {
          title: "Blood vessels and pressure",
          material:
            "Arteries carry blood away from the heart under high pressure and have thick elastic walls; veins return blood at low pressure and contain valves; capillaries are one cell thick to allow exchange. Blood pressure is reported as systolic over diastolic.",
          plannedDay: -5,
          attempts: {
            // Planned for day −5, but that day was skipped entirely — the learner
            // caught up on day −4. `introducedDay: -4` is the journal fact.
            introducedDay: -4,
            reviewDays: [-3, -1, 0],
            firstAccuracy: 0.7,
            steadyAccuracy: 0.86,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "Which vessel type has the largest total cross-sectional area?",
              options: ["Capillaries", "Arteries", "Veins", "Arterioles"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "A blood pressure of 120/80 mmHg means the diastolic pressure is:",
              options: ["80 mmHg", "120 mmHg", "40 mmHg", "200 mmHg"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Veins contain valves primarily to:",
              options: [
                "Prevent backflow of blood returning to the heart",
                "Increase the speed of blood flow",
                "Allow gas exchange with tissues",
                "Generate the pulse pressure",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Why are capillary walls only one cell thick?",
              back: "To minimise the diffusion distance so oxygen, carbon dioxide, nutrients and wastes can be exchanged rapidly between blood and tissue.",
            },
            {
              type: "FLASHCARD",
              prompt: "What is vasoconstriction and what does it do to blood pressure?",
              back: "Narrowing of arteriole lumens by contraction of smooth muscle in their walls. It raises peripheral resistance and therefore raises blood pressure.",
            },
          ],
        },
      ],
    },
    {
      title: "Respiratory & Renal",
      topics: [
        {
          title: "Gas exchange",
          material:
            "Gas exchange occurs across the alveolar membrane by simple diffusion down partial pressure gradients. Oxygen binds haemoglobin cooperatively, producing the sigmoid oxygen dissociation curve; most carbon dioxide travels as bicarbonate.",
          plannedDay: 2,
          questions: [
            {
              type: "MCQ",
              prompt: "Most carbon dioxide is transported in the blood as:",
              options: [
                "Bicarbonate ions dissolved in plasma",
                "Carbaminohaemoglobin",
                "Gas dissolved in plasma",
                "Carbon monoxide",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "The Bohr effect describes how a fall in blood pH causes haemoglobin to:",
              options: [
                "Release oxygen more readily",
                "Bind oxygen more tightly",
                "Stop binding carbon dioxide",
                "Denature irreversibly",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Gas exchange in the alveoli occurs by:",
              options: [
                "Simple diffusion down partial pressure gradients",
                "Active transport using ATP",
                "Osmosis",
                "Facilitated diffusion through protein channels",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Why is the oxygen dissociation curve sigmoid?",
              back: "Because haemoglobin binds oxygen cooperatively: each of the four bound oxygen molecules changes the protein's conformation and increases its affinity for the next.",
            },
            {
              type: "FLASHCARD",
              prompt: "Name three features of alveoli that make them efficient for exchange.",
              back: "Enormous total surface area, walls one cell thick (short diffusion path), and a dense capillary network that maintains a steep concentration gradient.",
            },
          ],
        },
        {
          title: "Nephron function",
          material:
            "The nephron filters blood at the glomerulus, reabsorbs useful solutes and water along the tubule, and secretes wastes. The loop of Henle establishes the medullary osmotic gradient that lets the collecting duct concentrate urine under ADH.",
          plannedDay: 8,
          questions: [
            {
              type: "MCQ",
              prompt: "Ultrafiltration in the nephron takes place at the:",
              options: [
                "Glomerulus and Bowman's capsule",
                "Loop of Henle",
                "Collecting duct",
                "Distal convoluted tubule",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Where is most glucose reabsorbed from the filtrate?",
              options: [
                "Proximal convoluted tubule",
                "Descending limb of the loop of Henle",
                "Collecting duct",
                "Bowman's capsule",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Antidiuretic hormone (ADH) acts by:",
              options: [
                "Increasing the water permeability of the collecting duct",
                "Increasing the glomerular filtration rate",
                "Blocking sodium reabsorption in the proximal tubule",
                "Stimulating glucose secretion into the filtrate",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is the countercurrent multiplier?",
              back: "The mechanism by which the loop of Henle uses opposing flow in its descending and ascending limbs, plus active sodium chloride transport out of the ascending limb, to build a concentration gradient in the medulla.",
            },
            {
              type: "FLASHCARD",
              prompt: "Why is glucose normally absent from urine?",
              back: "It is completely reabsorbed by sodium-glucose cotransporters in the proximal convoluted tubule — unless blood glucose exceeds the renal threshold and saturates them, as in untreated diabetes.",
            },
          ],
        },
        {
          title: "Acid-base balance",
          material:
            "Blood pH is held near 7.35–7.45 by the bicarbonate buffer system, respiratory control of carbon dioxide, and renal control of bicarbonate and hydrogen ions. The lungs respond within minutes; the kidneys take hours to days.",
          plannedDay: 14,
          questions: [
            {
              type: "MCQ",
              prompt: "The normal pH range of arterial blood is approximately:",
              options: ["7.35 – 7.45", "6.8 – 7.0", "7.8 – 8.0", "5.5 – 6.5"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Hyperventilation lowers blood carbon dioxide, which causes blood pH to:",
              options: [
                "Rise (respiratory alkalosis)",
                "Fall (respiratory acidosis)",
                "Stay exactly the same",
                "Fall then immediately rebound",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Which organ provides the slower but longer-lasting pH correction?",
              options: ["The kidneys", "The lungs", "The liver", "The spleen"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Write the bicarbonate buffer equilibrium.",
              back: "CO₂ + H₂O ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻. Removing CO₂ pulls the equilibrium left and consumes H⁺, raising pH; retaining CO₂ does the reverse.",
            },
            {
              type: "FLASHCARD",
              prompt: "What is metabolic acidosis?",
              back: "A fall in blood pH caused by accumulation of non-carbonic acid or loss of bicarbonate — for example diabetic ketoacidosis, lactic acidosis or severe diarrhoea. The lungs compensate by increasing ventilation.",
            },
          ],
        },
      ],
    },
  ],
};

/* ────────────────────────────────────────────────────────────────────────────
 * GOAL B — World History Midterm
 *
 * TARGET REGIME: SLIPPING (visible replan, recoverable within capacity).
 *
 * §5.5 arithmetic:
 *   totalActiveTopics = 9   examDay = +14   dailyNewTopicCap = 5   bufferDays = 2
 *   plan v0 spans day −21 … day +11  →  originalPlanLength = 33 days
 *   baselineRate = 9 / 33            = 0.273 topics/day
 *   ON_PACE threshold = 0.273 × 1.25 = 0.341
 *
 *   daysUsable   = (14 − 0) − 2 = 12
 *   introduced   = 4 (the four topics studied before the gap)
 *   remaining    = 9 − 4 = 5
 *   requiredRate = 5 / 12 = 0.417
 *
 *   0.341 < 0.417 ≤ cap 5  →  SLIPPING ✓  (visible replan, not triage)
 *
 * WHY: solid early history — topics planned −21, −17, −13 and −9 were all
 * introduced on time. Then a contiguous five-day gap (days −8 … −4, see
 * skipDays) swallowed the topics planned for −5 and −1 and killed the reviews
 * that fell inside it. Unlike Goal A's single lost day, this crosses the 1.25
 * tolerance: 0.417 is 1.53× baseline. It is still recoverable — redistributing
 * 5 topics over 12 usable days needs well under the 5-topics/day cap — so the
 * engine proposes a plan rather than forcing a cut. Margin holds under an
 * inclusive daysUsable reading (5/13 = 0.385, still > 0.341).
 *
 * DEMO VIDEO: the recovery case. Slipping banner → Recalibrate → proposed
 * plan v1 with the five remaining topics respread → confirm → dashboard
 * reports pace against the new plan version.
 * ──────────────────────────────────────────────────────────────────────────── */
const GOAL_B: FixtureGoal = {
  key: "B",
  title: "World History Midterm",
  examDay: 14,
  dailyNewTopicCap: 5,
  bufferDays: 2,
  skipDays: [-8, -7, -6, -5, -4],
  modules: [
    {
      title: "The Ancient World",
      topics: [
        {
          title: "Mesopotamia and the first cities",
          material:
            "Sumerian city-states in the fertile crescent between the Tigris and Euphrates produced the earliest known writing, cuneiform, around 3200 BCE. The Code of Hammurabi, promulgated in Babylon in the eighteenth century BCE, is among the earliest surviving written law codes.",
          plannedDay: -21,
          attempts: {
            introducedDay: -21,
            reviewDays: [-20, -18, -14, -7, -2],
            firstAccuracy: 0.7,
            steadyAccuracy: 0.9,
          },
          questions: [
            {
              type: "MCQ",
              prompt:
                "Between which two rivers did Mesopotamian civilisation develop?",
              options: [
                "The Tigris and the Euphrates",
                "The Nile and the Jordan",
                "The Indus and the Ganges",
                "The Danube and the Rhine",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The Code of Hammurabi was issued by a ruler of:",
              options: ["Babylon", "Athens", "Thebes", "Nineveh"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Cuneiform script was originally written by pressing a stylus into:",
              options: ["Wet clay tablets", "Papyrus", "Parchment", "Wax-coated wood"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What was a ziggurat?",
              back: "A massive stepped temple platform at the centre of a Mesopotamian city, dedicated to the city's patron deity and serving as its religious and administrative heart.",
            },
            {
              type: "FLASHCARD",
              prompt: "Why did writing first emerge in Sumer?",
              back: "Primarily for administration — recording grain stores, livestock, taxes and trade in an increasingly complex urban economy. Literary use came centuries later.",
            },
          ],
        },
        {
          title: "Ancient Egypt",
          material:
            "Egyptian civilisation depended on the Nile's annual flood. Rule was divided into the Old, Middle and New Kingdoms, separated by Intermediate Periods. Hieroglyphs were deciphered in 1822 by Jean-François Champollion using the Rosetta Stone.",
          plannedDay: -17,
          attempts: {
            introducedDay: -17,
            reviewDays: [-16, -14, -10, -6, -1],
            firstAccuracy: 0.72,
            steadyAccuracy: 0.9,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "The Great Pyramid at Giza was built during which period?",
              options: [
                "The Old Kingdom",
                "The New Kingdom",
                "The Ptolemaic period",
                "The Middle Kingdom",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Which artefact provided the key to deciphering hieroglyphs?",
              options: [
                "The Rosetta Stone",
                "The Behistun Inscription",
                "The Narmer Palette",
                "The Palermo Stone",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Egyptian agriculture depended above all on:",
              options: [
                "The annual flooding of the Nile depositing fertile silt",
                "Heavy seasonal monsoon rainfall",
                "Terraced irrigation from mountain snowmelt",
                "Rotation of nitrogen-fixing crops",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Who was Akhenaten and why is he notable?",
              back: "A New Kingdom pharaoh (reigned c. 1353–1336 BCE) who displaced Egypt's traditional gods in favour of the sun-disc Aten and moved the capital to Amarna — an experiment his successors reversed.",
            },
            {
              type: "FLASHCARD",
              prompt: "What was the purpose of mummification?",
              back: "To preserve the body so the soul could recognise and reinhabit it in the afterlife — the body was regarded as a necessary vessel for continued existence after death.",
            },
          ],
        },
        {
          title: "Classical Greece and Rome",
          material:
            "Athenian democracy gave political rights to adult male citizens, excluding women, slaves and foreigners. Rome moved from Republic to Empire when Augustus took power in 27 BCE; the Western Empire fell in 476 CE.",
          plannedDay: -13,
          attempts: {
            introducedDay: -13,
            reviewDays: [-12, -10, -6, -3],
            firstAccuracy: 0.68,
            steadyAccuracy: 0.88,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "Who became Rome's first emperor in 27 BCE?",
              options: [
                "Augustus",
                "Julius Caesar",
                "Nero",
                "Constantine",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Athenian democracy extended political participation to:",
              options: [
                "Adult male citizens only",
                "All adult residents of Athens",
                "All free adults including women",
                "Only members of the aristocracy",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The conventional date for the fall of the Western Roman Empire is:",
              options: ["476 CE", "410 CE", "1453 CE", "312 CE"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What were the Punic Wars?",
              back: "Three wars between Rome and Carthage (264–146 BCE). Rome won all three, destroyed Carthage in 146 BCE, and became the dominant power of the western Mediterranean.",
            },
            {
              type: "FLASHCARD",
              prompt: "Name the three branches of the Roman Republic's government.",
              back: "The magistrates (chiefly the two annually elected consuls), the Senate (an advisory body of former magistrates), and the popular assemblies that voted on laws and elected officials.",
            },
          ],
        },
      ],
    },
    {
      title: "Medieval & Early Modern",
      topics: [
        {
          title: "Byzantium and the Islamic Golden Age",
          material:
            "The Eastern Roman (Byzantine) Empire survived until Constantinople fell to the Ottomans in 1453. Meanwhile Abbasid Baghdad became a centre of scholarship, preserving and extending Greek mathematics, astronomy and medicine.",
          plannedDay: -9,
          attempts: {
            // The −8 and −6 reviews fall inside the gap and are dropped by
            // skipDays; study only resumes on day −2.
            introducedDay: -9,
            reviewDays: [-8, -6, -2, 0],
            firstAccuracy: 0.65,
            steadyAccuracy: 0.85,
          },
          questions: [
            {
              type: "MCQ",
              prompt: "Constantinople fell to the Ottoman Empire in:",
              options: ["1453", "1066", "1291", "1517"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which Byzantine emperor commissioned the legal compilation later known as the Corpus Juris Civilis?",
              options: ["Justinian I", "Constantine I", "Basil II", "Heraclius"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "The House of Wisdom, a major centre of translation and scholarship, was located in:",
              options: ["Baghdad", "Cairo", "Córdoba", "Damascus"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Who was al-Khwarizmi?",
              back: "A ninth-century Persian scholar in Baghdad whose treatise on solving equations gave algebra its name (al-jabr); the word 'algorithm' derives from the Latin form of his own name.",
            },
            {
              type: "FLASHCARD",
              prompt: "What was Greek fire?",
              back: "An incendiary weapon used by the Byzantine navy that continued burning on water. Its exact composition was a state secret and remains unknown.",
            },
          ],
        },
        {
          title: "Feudal Europe and the Crusades",
          material:
            "Feudalism organised medieval European society around reciprocal obligations of land for service. The First Crusade was launched in 1095 by Pope Urban II. The Black Death of 1347–1351 killed a large fraction of Europe's population and weakened serfdom by making labour scarce.",
          plannedDay: -5,
          questions: [
            {
              type: "MCQ",
              prompt: "Which pope called for the First Crusade in 1095?",
              options: ["Urban II", "Gregory VII", "Innocent III", "Leo IX"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The Black Death reached Europe in:",
              options: ["1347", "1215", "1453", "1096"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Magna Carta (1215) is significant chiefly because it:",
              options: [
                "Established that the king was subject to the law",
                "Abolished serfdom throughout England",
                "Granted the vote to all free men",
                "Ended the Hundred Years' War",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Describe the basic exchange at the heart of feudalism.",
              back: "A lord granted land (a fief) to a vassal; in return the vassal swore loyalty and provided military service. Peasants and serfs worked the land and owed labour and dues to the lord.",
            },
            {
              type: "FLASHCARD",
              prompt: "How did the Black Death weaken serfdom?",
              back: "By killing so many labourers that survivors could demand wages and better terms — labour scarcity shifted bargaining power away from landlords and helped dissolve compulsory servile tenure.",
            },
          ],
        },
        {
          title: "Renaissance and Reformation",
          material:
            "The Renaissance revived classical learning and humanist thought in Italy from the fourteenth century. Gutenberg's printing press (c. 1440) made mass reproduction of texts possible; Martin Luther's Ninety-five Theses of 1517 split Western Christianity.",
          plannedDay: -1,
          questions: [
            {
              type: "MCQ",
              prompt: "Martin Luther published his Ninety-five Theses in:",
              options: ["1517", "1492", "1453", "1648"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which invention most accelerated the spread of Reformation ideas?",
              options: [
                "The movable-type printing press",
                "The mechanical clock",
                "The telescope",
                "The steam engine",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Renaissance humanism is best characterised as:",
              options: [
                "A revival of classical learning centred on human potential and achievement",
                "A rejection of all religious belief",
                "A movement to restore feudal hierarchy",
                "An economic theory of free trade",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What practice most directly provoked Luther's protest?",
              back: "The sale of indulgences — payments claimed to reduce punishment for sin — which Luther argued had no scriptural basis and corrupted the church.",
            },
            {
              type: "FLASHCARD",
              prompt: "What was the Peace of Westphalia (1648)?",
              back: "The settlement ending the Thirty Years' War. It recognised state sovereignty over religious affairs and is conventionally treated as the origin of the modern European state system.",
            },
          ],
        },
      ],
    },
    {
      title: "The Modern Era",
      topics: [
        {
          title: "The Age of Exploration",
          material:
            "European maritime expansion from the fifteenth century opened sustained contact between the hemispheres. The resulting Columbian Exchange transferred crops, animals and — devastatingly — diseases, to which Indigenous American populations had no immunity.",
          plannedDay: 3,
          questions: [
            {
              type: "MCQ",
              prompt:
                "Which explorer's expedition completed the first circumnavigation of the globe?",
              options: [
                "Ferdinand Magellan's (completed by Elcano)",
                "Christopher Columbus's",
                "Vasco da Gama's",
                "Hernán Cortés's",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The Columbian Exchange refers to the transfer between hemispheres of:",
              options: [
                "Crops, animals, people and diseases",
                "Gold and silver only",
                "Religious doctrines only",
                "Naval technology only",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "The single largest cause of Indigenous population collapse in the Americas was:",
              options: [
                "Epidemic disease such as smallpox",
                "Battlefield casualties",
                "Famine caused by crop failure",
                "Emigration",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What was the Treaty of Tordesillas (1494)?",
              back: "A papally brokered agreement dividing newly encountered lands outside Europe between Portugal and Spain along a meridian in the Atlantic — which is why Brazil was colonised by Portugal.",
            },
            {
              type: "FLASHCARD",
              prompt: "Name two New World crops that transformed Old World diets.",
              back: "Potatoes and maize — both far more calorically productive per acre than European grains — alongside tomatoes, cassava and chili peppers.",
            },
          ],
        },
        {
          title: "The Industrial Revolution",
          material:
            "Beginning in Britain around 1760, mechanised production, coal power and the factory system transformed economies and societies. Urbanisation accelerated, a new industrial working class formed, and living standards eventually rose after a long, harsh transition.",
          plannedDay: 7,
          questions: [
            {
              type: "MCQ",
              prompt: "The Industrial Revolution began in:",
              options: ["Britain", "France", "Germany", "The United States"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Whose improved steam engine (patented 1769) was central to industrialisation?",
              options: [
                "James Watt",
                "Michael Faraday",
                "Eli Whitney",
                "Isambard Kingdom Brunel",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The enclosure movement contributed to industrialisation by:",
              options: [
                "Displacing rural labourers who then supplied urban factory workforces",
                "Banning the use of coal in the countryside",
                "Forcing landowners to build factories",
                "Guaranteeing peasants permanent tenure of common land",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Why did industrialisation start in Britain specifically?",
              back: "A combination of abundant coal and iron, capital from trade, a large mobile labour force, secure property rights and patent law, navigable rivers and canals, and colonial markets for finished goods.",
            },
            {
              type: "FLASHCARD",
              prompt: "Who were the Luddites?",
              back: "English textile workers who, from 1811, destroyed mechanised looms in protest at machinery that destroyed their skilled livelihoods — a protest about wages and conditions, not a superstition about technology.",
            },
          ],
        },
        {
          title: "The World Wars",
          material:
            "The First World War (1914–1918) ended with the Treaty of Versailles, whose punitive terms are widely argued to have contributed to the conditions for the Second (1939–1945). The Second World War ended in Europe in May 1945 and in the Pacific that September.",
          plannedDay: 11,
          questions: [
            {
              type: "MCQ",
              prompt: "The Treaty of Versailles was signed in:",
              options: ["1919", "1914", "1918", "1922"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The immediate trigger of the First World War was:",
              options: [
                "The assassination of Archduke Franz Ferdinand in Sarajevo",
                "The German invasion of Poland",
                "The sinking of the Lusitania",
                "The Russian Revolution",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The Second World War in Europe ended in:",
              options: ["May 1945", "September 1945", "November 1944", "August 1946"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What was the 'war guilt' clause?",
              back: "Article 231 of the Treaty of Versailles, which assigned responsibility for the war to Germany and its allies and provided the legal basis for reparations. It was deeply resented in Germany.",
            },
            {
              type: "FLASHCARD",
              prompt: "Why did the League of Nations fail to prevent the Second World War?",
              back: "It had no armed force of its own, required unanimity to act, and lacked key members — the United States never joined, and Germany, Japan and Italy withdrew — so its condemnations carried no enforcement.",
            },
          ],
        },
      ],
    },
  ],
};

/* ────────────────────────────────────────────────────────────────────────────
 * GOAL C — Statistics Exam
 *
 * TARGET REGIME: TRIAGE (required load exceeds capacity — a real cut is needed).
 *
 * §5.5 arithmetic:
 *   totalActiveTopics = 12   examDay = +5   dailyNewTopicCap = 2   bufferDays = 1
 *   plan v0 spans day −14 … day +4  →  originalPlanLength = 19 days
 *   baselineRate = 12 / 19 = 0.632 topics/day
 *
 *   daysUsable   = (5 − 0) − 1 = 4
 *   introduced   = 1 (only "Measures of central tendency" was ever studied)
 *   remaining    = 12 − 1 = 11
 *   requiredRate = 11 / 4 = 2.75
 *
 *   2.75 > dailyNewTopicCap 2  →  TRIAGE ✓
 *
 * Note the deliberately low cap (2/day) — this learner told us up front she
 * cannot absorb more than two new statistics topics in a day, and §5.5 takes
 * her at her word: beyond that ceiling, redistribution would only produce a
 * plan she has already said she cannot execute.
 *
 * MARGIN CHECK (both readings of daysUsable): the exclusive reading gives
 * 11/4 = 2.75 > 2, and an inclusive reading gives 11/5 = 2.2 > 2. TRIAGE under
 * either. This is why only ONE topic is introduced, not two: with 2 introduced,
 * the inclusive reading yields 10/5 = 2.0, which is exactly the cap and falls on
 * the SLIPPING side of the strict `>` comparison.
 *
 * §5.7 triage split:
 *   capacity = daysUsable × cap = 4 × 2 = 8
 *   ranked   = not-yet-ready topics, weakest readiness first
 *   keep     = 8   defer = the rest
 * The one introduced topic has partial readiness (a handful of shaky attempts,
 * ~50–65% correct), so it ranks above the eleven untouched topics at readiness
 * 0 — the kept set is a genuine mix and the deferred set is non-empty either
 * way. Not everything is deferred; not everything is kept.
 *
 * DEMO VIDEO: the honest-cut case. Triage screen showing the weakest-first
 * kept set alongside an explicit "won't reach" list with each deferred topic's
 * readiness shown — the cut is transparent, not hidden.
 * ──────────────────────────────────────────────────────────────────────────── */
const GOAL_C: FixtureGoal = {
  key: "C",
  title: "Statistics Exam",
  examDay: 5,
  dailyNewTopicCap: 2,
  bufferDays: 1,
  skipDays: [],
  modules: [
    {
      title: "Descriptive Statistics",
      topics: [
        {
          title: "Measures of central tendency",
          material:
            "The mean, median and mode summarise where a distribution sits. The mean uses every value and is therefore sensitive to outliers; the median is the middle value of the ordered data and is robust to them; the mode is the most frequent value.",
          plannedDay: -14,
          attempts: {
            // The only topic this learner ever touched — and shakily. Sparse,
            // weak history: partial readiness, well short of ready.
            introducedDay: -14,
            reviewDays: [-13, -10, -4],
            firstAccuracy: 0.5,
            steadyAccuracy: 0.65,
          },
          questions: [
            {
              type: "MCQ",
              prompt:
                "Which measure of central tendency is most robust to extreme outliers?",
              options: ["The median", "The mean", "The range", "The standard deviation"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "What is the median of the data set 3, 7, 8, 12, 100?",
              options: ["8", "12", "26", "7"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "In a right-skewed (positively skewed) distribution, the usual ordering is:",
              options: [
                "mode < median < mean",
                "mean < median < mode",
                "median < mode < mean",
                "mean = median = mode",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "When should you prefer the median to the mean?",
              back: "When the data are skewed or contain outliers — for example household income — because the mean is dragged toward extreme values while the median reports the typical case.",
            },
          ],
        },
        {
          title: "Measures of dispersion",
          material:
            "Dispersion describes spread. The range is the crudest measure; variance is the mean squared deviation from the mean; standard deviation is its square root, restoring the original units. The interquartile range is the robust alternative.",
          plannedDay: -13,
          questions: [
            {
              type: "MCQ",
              prompt: "The standard deviation is:",
              options: [
                "The square root of the variance",
                "The square of the variance",
                "The mean absolute deviation",
                "The difference between the maximum and minimum",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The interquartile range is calculated as:",
              options: ["Q3 − Q1", "Q4 − Q1", "Q3 − Q2", "max − min"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "If every value in a data set is identical, the standard deviation is:",
              options: ["0", "1", "Equal to the mean", "Undefined"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Why does the sample variance divide by n − 1 rather than n?",
              back: "Bessel's correction. Deviations are measured from the sample mean rather than the true population mean, which understates the spread; dividing by n − 1 makes the estimator unbiased.",
            },
          ],
        },
        {
          title: "Distribution shape and outliers",
          material:
            "Skewness measures asymmetry and kurtosis measures tail heaviness. A common outlier rule flags any point more than 1.5 × IQR below Q1 or above Q3 — the rule that draws the whiskers on a box plot.",
          plannedDay: -11,
          questions: [
            {
              type: "MCQ",
              prompt: "The standard 1.5 × IQR rule flags a value as an outlier if it lies:",
              options: [
                "Below Q1 − 1.5×IQR or above Q3 + 1.5×IQR",
                "More than 1.5 standard deviations from the mean",
                "Outside the range of the middle 50% of the data",
                "Below the median",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "A distribution with a long tail to the right is described as:",
              options: [
                "Positively skewed",
                "Negatively skewed",
                "Symmetric",
                "Platykurtic",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "In a box plot, the line inside the box marks the:",
              options: ["Median", "Mean", "Mode", "Midrange"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Should an outlier always be removed from the data?",
              back: "No. Investigate it first. It may be a recording error (fix or drop it) or a genuine extreme observation carrying real signal — discarding it would bias the analysis.",
            },
          ],
        },
        {
          title: "Correlation",
          material:
            "Pearson's r measures the strength and direction of a linear relationship, ranging from −1 to +1. It captures only linear association, and correlation alone never establishes causation.",
          plannedDay: -9,
          questions: [
            {
              type: "MCQ",
              prompt: "Pearson's correlation coefficient r can take values in the range:",
              options: ["−1 to +1", "0 to 1", "−∞ to +∞", "0 to 100"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "A correlation of r = 0 between two variables means there is no:",
              options: [
                "Linear relationship between them",
                "Relationship of any kind between them",
                "Causal link between them",
                "Variance in either variable",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Ice cream sales and drowning deaths rise together each summer. This is best explained by:",
              options: [
                "A confounding variable — hot weather drives both",
                "Ice cream consumption causing drowning",
                "Drowning deaths causing ice cream sales",
                "A statistical impossibility",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "When is Spearman's rank correlation preferred over Pearson's r?",
              back: "When the relationship is monotonic but not linear, when the data are ordinal, or when outliers would distort Pearson's r — Spearman correlates ranks rather than raw values.",
            },
          ],
        },
      ],
    },
    {
      title: "Probability",
      topics: [
        {
          title: "Probability rules",
          material:
            "For mutually exclusive events, P(A or B) = P(A) + P(B); in general P(A or B) = P(A) + P(B) − P(A and B). For independent events, P(A and B) = P(A) × P(B). The complement rule gives P(not A) = 1 − P(A).",
          plannedDay: -8,
          questions: [
            {
              type: "MCQ",
              prompt: "For any two events A and B, P(A or B) equals:",
              options: [
                "P(A) + P(B) − P(A and B)",
                "P(A) + P(B)",
                "P(A) × P(B)",
                "P(A) − P(B)",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Two fair coins are tossed. The probability of two heads is:",
              options: ["0.25", "0.5", "0.75", "1.0"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "If P(A) = 0.3, then P(not A) is:",
              options: ["0.7", "0.3", "0.5", "1.3"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is the difference between mutually exclusive and independent events?",
              back: "Mutually exclusive events cannot both occur — P(A and B) = 0. Independent events do not affect each other's probability — P(A and B) = P(A)×P(B). Two events with non-zero probability cannot be both.",
            },
          ],
        },
        {
          title: "Conditional probability and Bayes",
          material:
            "P(A|B) = P(A and B) / P(B). Bayes' theorem rearranges this to P(A|B) = P(B|A)·P(A) / P(B), letting you invert a conditional — the basis of diagnostic test reasoning.",
          plannedDay: -6,
          questions: [
            {
              type: "MCQ",
              prompt: "Bayes' theorem states that P(A|B) equals:",
              options: [
                "P(B|A) × P(A) / P(B)",
                "P(A) × P(B)",
                "P(A|B) × P(B)",
                "P(A) + P(B) − P(A and B)",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "A rare disease affects 1 in 1000. A test is 99% accurate both ways. A random person tests positive. The probability they actually have the disease is closest to:",
              options: ["9%", "99%", "50%", "1%"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "P(A|B) is read as:",
              options: [
                "The probability of A given that B has occurred",
                "The probability of B given that A has occurred",
                "The probability of A and B both occurring",
                "The probability of either A or B occurring",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is the base rate fallacy?",
              back: "Judging a conditional probability from test accuracy alone while ignoring how rare the condition is. For a rare disease, most positives are false positives even with a highly accurate test — because the healthy group is so much larger.",
            },
          ],
        },
        {
          title: "Random variables",
          material:
            "A random variable maps outcomes to numbers. Discrete variables take countable values and are described by a probability mass function; continuous variables use a probability density function. Expected value is the probability-weighted mean of the outcomes.",
          plannedDay: -4,
          questions: [
            {
              type: "MCQ",
              prompt: "The expected value of a fair six-sided die roll is:",
              options: ["3.5", "3", "4", "6"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Which of the following is a continuous random variable?",
              options: [
                "The height of a randomly chosen adult",
                "The number of heads in ten coin tosses",
                "The number of cars passing in an hour",
                "The roll of a die",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "For a continuous random variable, the probability of any single exact value is:",
              options: [
                "0",
                "1",
                "Equal to the density at that point",
                "Undefined",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Define the expected value E(X) of a discrete random variable.",
              back: "E(X) = Σ xᵢ·P(X = xᵢ) — each possible value weighted by its probability. It is the long-run average value of X over many independent repetitions.",
            },
          ],
        },
        {
          title: "Common distributions",
          material:
            "The binomial distribution counts successes in a fixed number of independent trials with constant success probability. The Poisson models counts of rare events per interval. The normal distribution is the symmetric bell curve defined by its mean and standard deviation.",
          plannedDay: -3,
          questions: [
            {
              type: "MCQ",
              prompt:
                "Which distribution models the number of successes in a fixed number of independent Bernoulli trials?",
              options: ["Binomial", "Poisson", "Normal", "Exponential"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "Under the empirical rule, roughly what percentage of a normal distribution lies within one standard deviation of the mean?",
              options: ["68%", "95%", "99.7%", "50%"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "The mean of a binomial distribution with n trials and success probability p is:",
              options: ["np", "np(1 − p)", "p / n", "n / p"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is a z-score?",
              back: "The number of standard deviations a value lies from the mean: z = (x − μ) / σ. It puts values from different normal distributions on a common scale.",
            },
          ],
        },
      ],
    },
    {
      title: "Statistical Inference",
      topics: [
        {
          title: "Sampling and the Central Limit Theorem",
          material:
            "The Central Limit Theorem states that the sampling distribution of the sample mean approaches a normal distribution as sample size grows, whatever the shape of the population — which is what makes normal-based inference so widely applicable.",
          plannedDay: -1,
          questions: [
            {
              type: "MCQ",
              prompt: "The Central Limit Theorem concerns the distribution of:",
              options: [
                "The sample mean across repeated samples",
                "The population itself",
                "A single observation",
                "The population variance",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "The standard error of the mean for a population with standard deviation σ and sample size n is:",
              options: ["σ / √n", "σ / n", "σ × √n", "σ²/ n"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Quadrupling the sample size reduces the standard error by a factor of:",
              options: ["2", "4", "16", "It is unchanged"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "Why does the CLT matter in practice?",
              back: "Because it lets you use normal-based confidence intervals and tests on the sample mean even when the underlying population is not normal, provided the sample is large enough and observations are independent.",
            },
          ],
        },
        {
          title: "Confidence intervals",
          material:
            "A 95% confidence interval is constructed by a procedure that captures the true parameter in 95% of repeated samples. It is a statement about the long-run behaviour of the method, not the probability that this one interval contains the parameter.",
          plannedDay: 1,
          questions: [
            {
              type: "MCQ",
              prompt: "A 95% confidence interval is correctly interpreted as:",
              options: [
                "95% of intervals built this way from repeated samples would contain the true parameter",
                "There is a 95% probability the true parameter lies in this specific interval",
                "95% of the data lie inside the interval",
                "The sample mean is correct 95% of the time",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Increasing the confidence level from 90% to 99%, all else equal, makes the interval:",
              options: ["Wider", "Narrower", "Unchanged", "Undefined"],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "Increasing the sample size, all else equal, makes a confidence interval:",
              options: ["Narrower", "Wider", "Unchanged", "Always symmetric"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is the margin of error?",
              back: "The half-width of a confidence interval: the critical value multiplied by the standard error. The interval is the point estimate plus or minus this quantity.",
            },
          ],
        },
        {
          title: "Hypothesis testing",
          material:
            "A hypothesis test assumes the null hypothesis and asks how surprising the observed data would be under it. The p-value quantifies that surprise. A Type I error rejects a true null; a Type II error fails to reject a false one.",
          plannedDay: 2,
          questions: [
            {
              type: "MCQ",
              prompt: "The p-value is the probability of:",
              options: [
                "Observing data at least as extreme as ours, assuming the null hypothesis is true",
                "The null hypothesis being true",
                "The alternative hypothesis being true",
                "Making a Type II error",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "A Type I error occurs when you:",
              options: [
                "Reject a null hypothesis that is actually true",
                "Fail to reject a null hypothesis that is actually false",
                "Choose the wrong significance level",
                "Use too small a sample",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt:
                "With a significance level of 0.05, a p-value of 0.03 means you should:",
              options: [
                "Reject the null hypothesis",
                "Accept the null hypothesis as proven",
                "Fail to reject the null hypothesis",
                "Conclude the effect is large",
              ],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is statistical power?",
              back: "The probability of correctly rejecting a false null hypothesis — that is, 1 − P(Type II error). Power rises with larger sample size, larger true effect, and lower variance.",
            },
          ],
        },
        {
          title: "Simple linear regression",
          material:
            "Simple linear regression fits ŷ = b₀ + b₁x by minimising the sum of squared residuals. The slope b₁ estimates the change in y per unit change in x; R² reports the proportion of variance in y explained by the model.",
          plannedDay: 4,
          questions: [
            {
              type: "MCQ",
              prompt: "Ordinary least squares regression chooses the line that minimises:",
              options: [
                "The sum of the squared residuals",
                "The sum of the residuals",
                "The maximum residual",
                "The correlation coefficient",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "An R² of 0.64 means the model explains:",
              options: [
                "64% of the variance in the response variable",
                "64% of the data points exactly",
                "That the correlation is 0.64",
                "That 64% of predictions are correct",
              ],
              correctIndex: 0,
            },
            {
              type: "MCQ",
              prompt: "In the model ŷ = 3 + 2x, the predicted value of y when x = 4 is:",
              options: ["11", "8", "14", "9"],
              correctIndex: 0,
            },
            {
              type: "FLASHCARD",
              prompt: "What is a residual?",
              back: "The difference between an observed value and the value the model predicts for it: e = y − ŷ. Plotting residuals against fitted values is the standard check that the model's assumptions hold.",
            },
          ],
        },
      ],
    },
  ],
};

export const GOALS: FixtureGoal[] = [GOAL_A, GOAL_B, GOAL_C];
