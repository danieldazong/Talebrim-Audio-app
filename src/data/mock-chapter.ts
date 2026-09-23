// MOCK — prompt 15 fetches real script_text
//
// Imported only by `app/reader/[chapterId].tsx`, and deleted by prompt 15.
// The values are placeholder copy from material/7.png, not data.
import type { ReaderStatus } from "@/types/states";

export type MockChapter = {
  bookTitle: string;
  chapterNumber: number;
  /** Nullable, like `chapters.title`. */
  chapterTitle: string | null;
  chapterCount: number;
  scriptText: string;
  /** Change this to view each state in prompt 14 step 18. */
  status: ReaderStatus;
};

const paragraphs = [
  "The castle courtyard was hushed save for the whisper of the autumn wind through iron gateposts. Snow dusted the cold flagstones like scattered bone-dust, glistening under a fractured moon.",
  "Julian stood by the arched parapet, his silhouette carved out of pure midnight velvet. He did not turn as Vivienne approached, yet she felt the pull—a quiet, gravitational drag in the hollow of her chest that made her breath catch.",
  "\"You shouldn't wander past the bell tower,\" he murmured, his voice rich and low like aged wine. \"My brethren are not all accustomed to your scent.\"",
  "\"I didn't ask for their welcome,\" Vivienne said, stepping closer until the hem of her cloak brushed the frost-rimed stone. \"And I didn't ask for yours either. Yet here you are, every night, waiting on the same wall as if the view might change.\"",
  "That earned her the ghost of a smile. It was there and gone, a flicker at the corner of his mouth, but she had learned to catalogue them the way a sailor learns the stars. Seven smiles in three weeks. Each one had cost him something; she could see it in the careful way he rebuilt his face afterward.",
  "\"The view does change,\" he said. \"The village lights go out one by one. The river freezes from the edges inward. Somewhere past the ridge a wolf calls, and another answers, and then there is nothing but the wind for an hour. I have watched it for a very long time, Vivienne. It is never the same night twice.\"",
  "\"That sounds lonely.\"",
  "\"It sounds _patient_.\" He turned at last, and the moonlight found the sharp architecture of his face—the high cheekbones, the faint shadow beneath each eye, the mouth that had not tasted daylight in two hundred years. \"Loneliness is what mortals call patience when they have not yet learned what it buys.\"",
  // A single line break inside a paragraph is a soft wrap: it reads as a space.
  "She wanted to answer that. She wanted to tell him that she had been patient too, in her own small way—patient through her father's long illness, patient through the winter the mill burned,\npatient through every sermon that promised rescue and delivered none. But the words tangled somewhere behind her teeth, because he was looking at her the way he never did in the great hall, openly, without the courtly mask he wore for the Council.",
  "\"What does it buy?\" she asked instead.",
  "\"Tonight?\" Julian glanced up at the broken moon. \"An answer, perhaps. You came here for one.\"",
  "He was right, of course. She had come with the letter still folded inside her glove, its wax seal cracked where her thumb had worried at it all through supper. She drew it out now and held it between them, a pale rectangle trembling slightly in the cold.",
  "\"The Council has summoned me,\" she said. \"Tomorrow, at the ninth bell. It says I am to be **presented**.\" She let the word hang in the frozen air. \"I know what that means in the old houses. I've read enough of your library to know. So I'm asking you plainly, because no one else in this castle will: what am I to be presented _as_?\"",
  "For a long moment he said nothing at all. Snow drifted between them, settling on the letter, on her hair, on the shoulders of his coat where it did not melt. The bell tower creaked above them in the wind, and somewhere deep in the castle a door closed with a sound like a held breath finally released.",
  "\"As a claim,\" Julian said at last. \"Or as a threat. The Council has not decided which, and that is why they want to see you.\"",
  "Vivienne laughed, though there was nothing funny in it. \"A threat. Me. I can barely lift a sword. I spent my first week here being sick into a basin every time someone mentioned supper.\"",
  "\"You walked through the eastern gate on the night of the eclipse,\" he said quietly, \"and the wards did not wake. Do you understand what that means? Four hundred years those wards have stood. They have turned back hunters and priests and armies with torches. They know the difference between a guest and an enemy, and they have never once let a living thing pass without asking its name.\" He took a step toward her. \"They did not ask yours.\"",
  "The cold seemed to deepen around her. She thought of that night—the red rim of the eclipsed moon, the storm at her back, the gate standing open as though someone had been expecting her. She had assumed a servant had forgotten to bar it. She had assumed a great many things.",
  "\"Then what am I?\"",
  "\"I don't know.\" It was the first time she had heard him admit such a thing, and it frightened her more than anything else he had said. \"Neither does the Council. Some of them believe you are a key. Some of them believe you are a lock. Lord Castellane believes you are an accident that should be corrected before the spring thaw.\"",
  "\"Corrected,\" she repeated.",
  "\"His word, not mine.\"",
  "\"And what do you believe?\"",
  "Julian looked at her for a long time. When he finally spoke, his voice had lost all its polish; it was rough, almost human. \"I believe I have not wanted to stand on this wall in two hundred years. And for three weeks I have come here every night, not for the river or the wolves, but because it is where you walk after supper when you think no one is watching.\"",
  "The confession landed between them like a stone dropped into still water. Vivienne felt the ripples of it move outward through her body, loosening something in her knees, tightening something in her throat. She had imagined—she would never admit how often—what it might be like to hear him say something true. She had not imagined it would sound so much like grief.",
  "\"You shouldn't tell me that,\" she whispered.",
  "\"No,\" he agreed. \"I shouldn't.\"",
  "Neither of them moved. The snow kept falling. Below them, in the courtyard, a lantern swung into view: one of the night wardens making his round, the light pooling gold on the flagstones and then sliding away. Julian's hand rose, as if to touch her cheek, and stopped a finger's width from her skin. She could feel the cold coming off him, the stillness of a body that no longer bothered with warmth.",
  "\"If I go before the Council tomorrow,\" she said, \"will you be there?\"",
  "\"Every member of the house will be there.\"",
  "\"That isn't what I asked.\"",
  "His hand fell away. \"I will be there,\" he said. \"At the left hand of the throne, where I have stood for a century. And whatever they decide, Vivienne, I will be required to agree with it aloud.\"",
  "She understood then what the letter really was. Not a summons. A test—of her, yes, but also of him. The Council had seen what she had seen: seven smiles in three weeks, a lord who had not walked the walls in two centuries suddenly keeping vigil above the kitchen garden. They wanted to know where his loyalty would fall when it was made to choose.",
  // The dashboard's heading button prefixes one line, so a heading can run
  // straight into its paragraph with no blank line between them.
  "## Beneath the Bell Tower\nThe stair that wound down beneath the bell tower was older than the rest of the castle, its steps worn into shallow bowls by centuries of feet. Julian led the way without a lantern. Vivienne followed the pale shape of his collar and the sound of his voice, which he kept low and steady, the way one might speak to a frightened horse.",
  "\"The first lords of this house were not vampires,\" he said. \"They were wardens. Men and women who kept the boundary between this valley and whatever lay beyond the ridge. The wards were theirs before they were ours. We inherited them, the way one inherits a house and finds the previous owner's letters still in the desk.\"",
  "\"And the letters say?\"",
  "\"Very little that anyone can read.\" They reached a landing where the stair turned, and he paused beside a narrow door bound in black iron. \"But there is a chamber below the tower that the Council does not visit. I found it when I was young—young by our reckoning—and I have not shown it to anyone since.\"",
  "He pressed his palm flat against the iron. For a moment nothing happened. Then Vivienne heard it: a low chime, felt more than heard, like the echo of a bell struck very far away. The door swung inward on hinges that made no sound at all.",
  "The chamber beyond was round and bare, lit by a single shaft of moonlight falling through a slot in the ceiling. Its walls were covered in writing—not ink, but lines cut into the stone itself, row upon row of them, spiralling downward from the ceiling to the floor. At the centre of the room stood a stone basin filled with still, black water.",
  "\"Look,\" Julian said.",
  "She stepped to the basin. Her reflection looked back at her: pale, snow in her hair, eyes too wide. And then the water shivered, and the reflection changed. The woman in the basin wore a cloak of deep red. Her hair was bound with silver. Behind her, instead of a bare stone wall, stood the eastern gate—open, the eclipsed moon burning above it—and around her throat hung a pendant shaped like a crescent swallowing a star.",
  "Vivienne jerked back so quickly she nearly fell. Julian caught her elbow, his grip cool and certain.",
  "\"Who was that?\"",
  "\"The last warden,\" he said. \"The one who sealed this chamber. Her name is written on the lowest ring of the wall, and it is the only name down there that the stone has kept whole.\" He turned her gently toward the far side of the room, where the moonlight fell across the final line of carving. \"Read it.\"",
  "She did not want to. She knew, with the same cold certainty that had carried her through the gate, what it would say. But she crouched anyway, and brushed the frost from the letters with her gloved fingers, and read them aloud in a voice that did not sound like her own.",
  "**Vivienne of the Eastern Gate.**",
  "The silence afterward was so complete she could hear the snow landing on the roof far above them.",
  "\"That's not possible,\" she said.",
  "\"Four hundred years ago,\" Julian said softly, \"a warden named Vivienne closed the eastern gate against something that came over the ridge during an eclipse. She did it by binding the wards to her own blood. The histories say she died doing it. The stone says she promised to come back and open it again, when the valley was ready.\" He crouched beside her. \"The Council has read the same histories. They have never been down here. They do not know about this wall. But they know enough to be afraid of you.\"",
  "\"And you?\" she asked. \"Are you afraid of me?\"",
  "He considered the question with the seriousness he gave everything. \"I am afraid _for_ you,\" he said. \"It is not the same thing. It is **much _worse_**.\"",
  "She laughed—a small, cracked sound—and then, before she could think better of it, she leaned her forehead against his shoulder. He went very still. Then, slowly, as though relearning a motion he had long forgotten, his arm came around her.",
  "They stayed like that for a long time in the moonlit room, the name on the wall between them, the black water in the basin holding perfectly, patiently still.",
  "\"Tomorrow,\" Julian said at last, \"Castellane will ask you where you came from. Tell him the truth: a village beyond the river, a sick father, a burned mill. Tell him nothing about this room. And when he asks whether you know why the wards let you pass—\"",
  "\"I say I don't know.\"",
  "\"You say you don't know,\" he agreed. \"Which, until tonight, was true.\"",
  "They did not leave at once. Julian showed her the rest of the wall first, walking her along the spiral of names the way another man might have walked her through a gallery of family portraits. Most of the carvings had worn to shallow scratches. A few had been struck through, deliberately, with a single hard line. One had been carved over so many times that the stone around it had crumbled into a shallow bowl.",
  "\"Who were they?\" she asked, touching the edge of the bowl.",
  "\"Wardens who failed,\" Julian said. \"Or wardens someone wished had failed. The histories are not always kind to the people who wrote them.\" He crouched beside the ruined name and brushed away the dust with the side of his hand. \"This one was a boy of fifteen. He held the ridge for three winters alone. When the old lords took the valley, they tried to erase him first, because the villagers still sang about him.\"",
  "\"Did it work?\"",
  "\"You tell me.\" He tilted his head toward the bowl. \"They carved over him a hundred times, and the stone still remembers where he was.\"",
  "Vivienne found she could not look away from it. The hollow in the rock was smooth as the inside of a cup, polished by centuries of hands—not the hands of the people who had tried to erase him, she realised, but the hands of people who had come down here in secret to touch the place where his name had been. Someone had kept coming. Someone had remembered him on purpose.",
  "\"Why are you showing me this?\"",
  "Julian was quiet for a moment. When he answered, he did not look at her; he looked at the basin, where the black water had gone smooth again. \"Because tomorrow they will try to decide what you are before you have had the chance to decide it yourself. I wanted you to know that the stone has been wrong before. And that it has also, once or twice, been right.\"",
  "They left the chamber together. The iron door swung shut behind them without a sound, and the chime she had felt on the way in came again, fainter, like a bell answering itself from very far off.",
  "## The Steward's Lantern",
  "They were halfway up the stair when the light found them.",
  "It came from above, swinging and uneven, throwing their shadows long against the curved wall. Julian stopped so abruptly that Vivienne nearly walked into his back. In the space of a single breath he changed—his shoulders squared, his face smoothed into the courtly blankness he wore in the great hall, and the rough, human voice she had heard at the parapet vanished as if it had never existed.",
  "\"Lord Julian.\" The voice belonged to Aldric, Castellane's steward, a thin grey man who carried his lantern the way a priest carries a censer. He descended three more steps and lifted the light until it fell full on Vivienne's face. \"And the guest. How fortunate. I had been told the guest was in her rooms.\"",
  "\"The guest wished to see the bell tower,\" Julian said. \"I was showing her the way back. The lower stair is treacherous in the frost.\"",
  "\"Is it?\" Aldric's gaze travelled past them, down into the darkness where the stair wound toward the iron door. \"I confess I have never been below the second landing. Lord Castellane says there is nothing down there but damp and old stone.\"",
  "\"Lord Castellane is rarely wrong about damp,\" Julian said pleasantly.",
  "Something moved behind the steward's eyes—amusement, or calculation, or both. He lowered the lantern a fraction. \"The Council convenes at the ninth bell, my lady. You will want to rest. It would be a great pity if you arrived tired, and said something you did not mean.\"",
  "\"I rarely say things I don't mean,\" Vivienne said.",
  "\"No,\" Aldric agreed softly. \"I don't imagine you do. That is precisely the concern.\" He stepped aside, pressing his back to the wall so they could pass, and held the lantern high to light their way. It was a courtesy. It was also, she understood, a way of watching their faces as they went by.",
  "She did not look at Julian. She kept her eyes on the steps, on the worn stone bowls filling slowly with drifted snow, and counted them under her breath the way she used to count the rows of her father's barley. Forty-one. Forty-two. By the time she reached fifty the lantern light had fallen away behind them, and there was only the pale square of the open door above, and the moon beyond it, cracked and patient and cold.",
  "\"He will tell Castellane,\" she whispered.",
  "\"He will tell Castellane that he found us on the stair,\" Julian murmured. \"Which is true. And Castellane will wonder what we were doing there, which he was always going to do. The only thing that matters now is what he does not know.\" He glanced at her sidelong. \"You counted the steps.\"",
  "\"It helps.\"",
  "\"I know,\" he said. \"I used to count them too.\"",
  "At the top of the stair, where the tower door gave way to the cold night and the courtyard spread white beneath the moon, Julian stopped her with a hand on her wrist.",
  "\"Vivienne.\" Her name sounded different in his mouth now—heavier, older, as if it carried the weight of that wall. \"Whatever happens at the ninth bell, do not look at me. If you look at me, Castellane will know.\"",
  "\"Know what?\"",
  "He did not answer. He only let go of her wrist, one finger at a time, and stepped back into the shadow of the tower until she could no longer tell where he ended and the night began.",
  "Vivienne stood alone on the flagstones with the letter crushed in her glove and the snow falling, soft and endless, over the sleeping castle. Somewhere past the ridge a wolf called. After a long moment, another answered. And then there was nothing but the wind.",
  // Renderer check (prompt 14 step 5): unsupported syntax, which must render
  // as its literal characters — hashes, brackets, a lone ** and underscores.
  "### Renderer check. A [link](https://example.com) keeps its brackets, a lone ** shows two asterisks, and snake_case keeps its underscore.",
];

export const mockChapter: MockChapter = {
  bookTitle: "Eternal Eclipse",
  chapterNumber: 12,
  chapterTitle: "Blood & Starlight",
  chapterCount: 148,
  scriptText: paragraphs.join("\n\n"),
  status: "ready",
};
