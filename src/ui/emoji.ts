/**
 * Emoji shortcodes for the `:` autocomplete in the editor.
 *
 * A curated list, not a full emoji database: the point is that somebody typing
 * `:smi` gets 🙂 without knowing a keyboard shortcut, and for that a few
 * hundred well-named entries beat 3800 that have to be downloaded first. What
 * lands in the text is the character itself, not the shortcode — so the page
 * needs no emoji support to render it, and it survives every foreign client.
 * docs/13-editing.md
 */
export type Emoji = {
  /** shortcode without the colons */
  name: string
  char: string
  /** further words that should find it */
  keywords?: string
}

export const EMOJI: Emoji[] = [
  // faces
  { name: 'smile', char: '😄', keywords: 'happy joy grin' },
  { name: 'smiley', char: '😃', keywords: 'happy joy' },
  { name: 'grin', char: '😁', keywords: 'happy' },
  { name: 'slightly_smiling_face', char: '🙂', keywords: 'smile' },
  { name: 'laughing', char: '😆', keywords: 'lol haha satisfied' },
  { name: 'joy', char: '😂', keywords: 'laugh tears lol' },
  { name: 'rofl', char: '🤣', keywords: 'laugh rolling lol' },
  { name: 'wink', char: '😉', keywords: 'flirt' },
  { name: 'blush', char: '😊', keywords: 'shy smile' },
  { name: 'innocent', char: '😇', keywords: 'angel halo' },
  { name: 'heart_eyes', char: '😍', keywords: 'love crush' },
  { name: 'kissing_heart', char: '😘', keywords: 'love kiss' },
  { name: 'yum', char: '😋', keywords: 'tongue tasty' },
  { name: 'stuck_out_tongue', char: '😛', keywords: 'tongue cheeky' },
  { name: 'sunglasses', char: '😎', keywords: 'cool' },
  { name: 'nerd_face', char: '🤓', keywords: 'geek glasses' },
  { name: 'thinking', char: '🤔', keywords: 'hmm consider doubt' },
  { name: 'raised_eyebrow', char: '🤨', keywords: 'skeptical doubt' },
  { name: 'neutral_face', char: '😐', keywords: 'meh' },
  { name: 'expressionless', char: '😑', keywords: 'blank meh' },
  { name: 'no_mouth', char: '😶', keywords: 'silence quiet' },
  { name: 'smirk', char: '😏', keywords: 'smug' },
  { name: 'unamused', char: '😒', keywords: 'meh annoyed' },
  { name: 'roll_eyes', char: '🙄', keywords: 'eyeroll whatever' },
  { name: 'grimacing', char: '😬', keywords: 'awkward teeth' },
  { name: 'relieved', char: '😌', keywords: 'phew' },
  { name: 'pensive', char: '😔', keywords: 'sad' },
  { name: 'sleepy', char: '😪', keywords: 'tired' },
  { name: 'sleeping', char: '😴', keywords: 'zzz tired' },
  { name: 'mask', char: '😷', keywords: 'sick ill' },
  { name: 'face_with_thermometer', char: '🤒', keywords: 'sick ill fever' },
  { name: 'nauseated_face', char: '🤢', keywords: 'sick gross' },
  { name: 'sneezing_face', char: '🤧', keywords: 'sick cold' },
  { name: 'dizzy_face', char: '😵', keywords: 'confused' },
  { name: 'exploding_head', char: '🤯', keywords: 'mind blown shocked' },
  { name: 'cowboy', char: '🤠', keywords: 'hat' },
  { name: 'partying_face', char: '🥳', keywords: 'party celebrate' },
  { name: 'confused', char: '😕', keywords: 'unsure' },
  { name: 'worried', char: '😟', keywords: 'concern' },
  { name: 'frowning', char: '😦', keywords: 'sad' },
  { name: 'hushed', char: '😯', keywords: 'surprised' },
  { name: 'astonished', char: '😲', keywords: 'shocked wow' },
  { name: 'flushed', char: '😳', keywords: 'embarrassed blush' },
  { name: 'pleading_face', char: '🥺', keywords: 'please beg' },
  { name: 'frowning_face', char: '☹️', keywords: 'sad' },
  { name: 'anguished', char: '😧', keywords: 'shocked' },
  { name: 'fearful', char: '😨', keywords: 'scared' },
  { name: 'cold_sweat', char: '😰', keywords: 'nervous scared' },
  { name: 'cry', char: '😢', keywords: 'sad tear' },
  { name: 'sob', char: '😭', keywords: 'sad crying' },
  { name: 'scream', char: '😱', keywords: 'fear shocked' },
  { name: 'confounded', char: '😖', keywords: 'frustrated' },
  { name: 'persevere', char: '😣', keywords: 'struggling' },
  { name: 'disappointed', char: '😞', keywords: 'sad' },
  { name: 'sweat', char: '😓', keywords: 'hot nervous' },
  { name: 'weary', char: '😩', keywords: 'tired' },
  { name: 'tired_face', char: '😫', keywords: 'exhausted' },
  { name: 'triumph', char: '😤', keywords: 'proud steam' },
  { name: 'rage', char: '😡', keywords: 'angry mad' },
  { name: 'angry', char: '😠', keywords: 'mad' },
  { name: 'shushing_face', char: '🤫', keywords: 'quiet secret' },
  { name: 'zipper_mouth', char: '🤐', keywords: 'quiet secret' },
  { name: 'money_mouth', char: '🤑', keywords: 'rich' },
  { name: 'shrug', char: '🤷', keywords: 'dunno whatever' },
  { name: 'facepalm', char: '🤦', keywords: 'ugh disbelief' },
  { name: 'ghost', char: '👻', keywords: 'halloween boo' },
  { name: 'alien', char: '👽', keywords: 'ufo' },
  { name: 'robot', char: '🤖', keywords: 'bot ai' },
  { name: 'skull', char: '💀', keywords: 'dead' },
  { name: 'poop', char: '💩', keywords: 'shit crap' },
  { name: 'clown', char: '🤡', keywords: 'joke' },

  // hands & people
  { name: 'thumbsup', char: '👍', keywords: '+1 yes approve like' },
  { name: 'thumbsdown', char: '👎', keywords: '-1 no reject dislike' },
  { name: 'ok_hand', char: '👌', keywords: 'perfect' },
  { name: 'clap', char: '👏', keywords: 'applause bravo' },
  { name: 'raised_hands', char: '🙌', keywords: 'celebrate hooray' },
  { name: 'pray', char: '🙏', keywords: 'please thanks namaste' },
  { name: 'wave', char: '👋', keywords: 'hello bye hi' },
  { name: 'handshake', char: '🤝', keywords: 'deal agree' },
  { name: 'muscle', char: '💪', keywords: 'strong flex' },
  { name: 'point_right', char: '👉', keywords: 'this' },
  { name: 'point_left', char: '👈', keywords: 'that' },
  { name: 'point_up', char: '☝️', keywords: 'above' },
  { name: 'point_down', char: '👇', keywords: 'below' },
  { name: 'raised_hand', char: '✋', keywords: 'stop high five' },
  { name: 'v', char: '✌️', keywords: 'peace victory' },
  { name: 'crossed_fingers', char: '🤞', keywords: 'luck hope' },
  { name: 'writing_hand', char: '✍️', keywords: 'write note' },
  { name: 'eyes', char: '👀', keywords: 'look watch review' },
  { name: 'brain', char: '🧠', keywords: 'think smart' },
  { name: 'person_raising_hand', char: '🙋', keywords: 'question volunteer' },
  { name: 'detective', char: '🕵️', keywords: 'investigate search' },
  { name: 'technologist', char: '🧑‍💻', keywords: 'developer coder' },
  { name: 'construction_worker', char: '👷', keywords: 'wip building' },

  // hearts & symbols
  { name: 'heart', char: '❤️', keywords: 'love' },
  { name: 'orange_heart', char: '🧡', keywords: 'love' },
  { name: 'yellow_heart', char: '💛', keywords: 'love' },
  { name: 'green_heart', char: '💚', keywords: 'love' },
  { name: 'blue_heart', char: '💙', keywords: 'love' },
  { name: 'purple_heart', char: '💜', keywords: 'love' },
  { name: 'black_heart', char: '🖤', keywords: 'love' },
  { name: 'broken_heart', char: '💔', keywords: 'sad breakup' },
  { name: 'sparkling_heart', char: '💖', keywords: 'love' },
  { name: 'fire', char: '🔥', keywords: 'hot lit burn' },
  { name: 'sparkles', char: '✨', keywords: 'shiny new magic' },
  { name: 'star', char: '⭐', keywords: 'favourite' },
  { name: 'star2', char: '🌟', keywords: 'glowing' },
  { name: 'boom', char: '💥', keywords: 'explosion collision' },
  { name: 'zap', char: '⚡', keywords: 'lightning fast' },
  { name: 'dizzy', char: '💫', keywords: 'star' },
  { name: 'bulb', char: '💡', keywords: 'idea light' },
  { name: '100', char: '💯', keywords: 'hundred perfect' },
  { name: 'tada', char: '🎉', keywords: 'party celebrate release' },
  { name: 'confetti_ball', char: '🎊', keywords: 'party celebrate' },
  { name: 'balloon', char: '🎈', keywords: 'party' },
  { name: 'gift', char: '🎁', keywords: 'present' },
  { name: 'trophy', char: '🏆', keywords: 'win award' },
  { name: 'medal', char: '🏅', keywords: 'award win' },
  { name: 'crown', char: '👑', keywords: 'king queen' },
  { name: 'rocket', char: '🚀', keywords: 'launch ship deploy fast' },
  { name: 'checkered_flag', char: '🏁', keywords: 'finish race done' },

  // status & work
  { name: 'white_check_mark', char: '✅', keywords: 'done yes ok pass' },
  { name: 'heavy_check_mark', char: '✔️', keywords: 'done yes ok' },
  { name: 'x', char: '❌', keywords: 'no fail wrong' },
  { name: 'warning', char: '⚠️', keywords: 'caution careful' },
  { name: 'no_entry', char: '⛔', keywords: 'stop blocked forbidden' },
  { name: 'question', char: '❓', keywords: 'ask unclear' },
  { name: 'exclamation', char: '❗', keywords: 'important' },
  { name: 'bangbang', char: '‼️', keywords: 'important urgent' },
  { name: 'recycle', char: '♻️', keywords: 'reuse refactor' },
  { name: 'construction', char: '🚧', keywords: 'wip work in progress' },
  { name: 'hourglass', char: '⏳', keywords: 'waiting pending time' },
  { name: 'alarm_clock', char: '⏰', keywords: 'time reminder deadline' },
  { name: 'calendar', char: '📅', keywords: 'date schedule' },
  { name: 'pushpin', char: '📌', keywords: 'pin important' },
  { name: 'paperclip', char: '📎', keywords: 'attachment file' },
  { name: 'link', char: '🔗', keywords: 'url reference' },
  { name: 'lock', char: '🔒', keywords: 'private secure closed' },
  { name: 'unlock', char: '🔓', keywords: 'open public' },
  { name: 'key', char: '🔑', keywords: 'password secret access' },
  { name: 'mag', char: '🔍', keywords: 'search find' },
  { name: 'bookmark', char: '🔖', keywords: 'save' },
  { name: 'label', char: '🏷️', keywords: 'tag' },
  { name: 'memo', char: '📝', keywords: 'note write doc' },
  { name: 'page_facing_up', char: '📄', keywords: 'document file page' },
  { name: 'clipboard', char: '📋', keywords: 'list copy' },
  { name: 'books', char: '📚', keywords: 'docs read library' },
  { name: 'book', char: '📖', keywords: 'read docs' },
  { name: 'newspaper', char: '📰', keywords: 'news' },
  { name: 'chart_with_upwards_trend', char: '📈', keywords: 'growth metrics up' },
  { name: 'chart_with_downwards_trend', char: '📉', keywords: 'decline metrics down' },
  { name: 'bar_chart', char: '📊', keywords: 'metrics stats' },
  { name: 'inbox_tray', char: '📥', keywords: 'receive download' },
  { name: 'outbox_tray', char: '📤', keywords: 'send upload' },
  { name: 'mailbox', char: '📬', keywords: 'mail message' },
  { name: 'email', char: '📧', keywords: 'mail message' },
  { name: 'telephone', char: '☎️', keywords: 'call phone' },
  { name: 'speech_balloon', char: '💬', keywords: 'comment chat talk' },
  { name: 'thought_balloon', char: '💭', keywords: 'think idea' },
  { name: 'loudspeaker', char: '📢', keywords: 'announce' },
  { name: 'bell', char: '🔔', keywords: 'notify reminder' },
  { name: 'no_bell', char: '🔕', keywords: 'mute silence' },

  // tech
  { name: 'computer', char: '💻', keywords: 'laptop dev' },
  { name: 'desktop_computer', char: '🖥️', keywords: 'pc' },
  { name: 'keyboard', char: '⌨️', keywords: 'type' },
  { name: 'mobile_phone', char: '📱', keywords: 'phone mobile' },
  { name: 'floppy_disk', char: '💾', keywords: 'save disk' },
  { name: 'cd', char: '💿', keywords: 'disc' },
  { name: 'printer', char: '🖨️', keywords: 'print' },
  { name: 'battery', char: '🔋', keywords: 'power energy' },
  { name: 'electric_plug', char: '🔌', keywords: 'power connect' },
  { name: 'satellite', char: '📡', keywords: 'relay signal network' },
  { name: 'gear', char: '⚙️', keywords: 'settings config' },
  { name: 'wrench', char: '🔧', keywords: 'fix tool config' },
  { name: 'hammer', char: '🔨', keywords: 'build fix' },
  { name: 'hammer_and_wrench', char: '🛠️', keywords: 'tools build fix' },
  { name: 'nut_and_bolt', char: '🔩', keywords: 'hardware' },
  { name: 'screwdriver', char: '🪛', keywords: 'fix tool' },
  { name: 'test_tube', char: '🧪', keywords: 'test experiment' },
  { name: 'microscope', char: '🔬', keywords: 'research analyse' },
  { name: 'telescope', char: '🔭', keywords: 'explore look ahead' },
  { name: 'bug', char: '🐛', keywords: 'defect issue error' },
  { name: 'spider', char: '🕷️', keywords: 'crawler' },
  { name: 'shield', char: '🛡️', keywords: 'security protect' },
  { name: 'package', char: '📦', keywords: 'release build dependency' },
  { name: 'wastebasket', char: '🗑️', keywords: 'delete remove trash' },
  { name: 'card_index_dividers', char: '🗂️', keywords: 'organise folder' },
  { name: 'file_folder', char: '📁', keywords: 'directory' },
  { name: 'open_file_folder', char: '📂', keywords: 'directory' },

  // nature & food, for a bit of colour
  { name: 'sunny', char: '☀️', keywords: 'sun weather clear' },
  { name: 'cloud', char: '☁️', keywords: 'weather' },
  { name: 'umbrella', char: '☔', keywords: 'rain weather' },
  { name: 'snowflake', char: '❄️', keywords: 'cold winter freeze' },
  { name: 'rainbow', char: '🌈', keywords: 'colour pride' },
  { name: 'moon', char: '🌙', keywords: 'night dark' },
  { name: 'earth_africa', char: '🌍', keywords: 'world global' },
  { name: 'seedling', char: '🌱', keywords: 'new grow start' },
  { name: 'herb', char: '🌿', keywords: 'plant green' },
  { name: 'four_leaf_clover', char: '🍀', keywords: 'luck' },
  { name: 'maple_leaf', char: '🍁', keywords: 'autumn' },
  { name: 'cactus', char: '🌵', keywords: 'desert dry' },
  { name: 'mushroom', char: '🍄', keywords: 'fungus' },
  { name: 'coffee', char: '☕', keywords: 'break morning' },
  { name: 'tea', char: '🍵', keywords: 'break' },
  { name: 'beer', char: '🍺', keywords: 'drink cheers' },
  { name: 'clinking_glasses', char: '🥂', keywords: 'cheers celebrate' },
  { name: 'pizza', char: '🍕', keywords: 'food' },
  { name: 'hamburger', char: '🍔', keywords: 'food' },
  { name: 'cake', char: '🎂', keywords: 'birthday celebrate' },
  { name: 'doughnut', char: '🍩', keywords: 'food sweet' },
  { name: 'apple', char: '🍎', keywords: 'fruit' },
  { name: 'banana', char: '🍌', keywords: 'fruit' },
  { name: 'salt', char: '🧂', keywords: 'season' },
  { name: 'dog', char: '🐶', keywords: 'pet animal' },
  { name: 'cat', char: '🐱', keywords: 'pet animal' },
  { name: 'fox', char: '🦊', keywords: 'animal' },
  { name: 'bear', char: '🐻', keywords: 'animal' },
  { name: 'penguin', char: '🐧', keywords: 'animal linux' },
  { name: 'owl', char: '🦉', keywords: 'animal wise night' },
  { name: 'whale', char: '🐳', keywords: 'animal docker' },
  { name: 'dolphin', char: '🐬', keywords: 'animal' },
  { name: 'snail', char: '🐌', keywords: 'slow' },
  { name: 'turtle', char: '🐢', keywords: 'slow' },
  { name: 'rabbit', char: '🐰', keywords: 'fast animal' },
  { name: 'unicorn', char: '🦄', keywords: 'magic rare' },
  { name: 'ostrich', char: '🦢', keywords: 'bird' },
  { name: 'bird', char: '🐦', keywords: 'animal' },
  { name: 'honeybee', char: '🐝', keywords: 'busy insect' },
  { name: 'ant', char: '🐜', keywords: 'insect small' },
]

/**
 * Ranked matches for a typed shortcode. A prefix hit on the name outranks one
 * in the middle, and a keyword hit comes last — so `:car` offers `card_index`
 * before `scared`.
 */
export function searchEmoji(query: string, limit = 12): Emoji[] {
  const needle = query.toLowerCase()
  if (needle.length === 0) return EMOJI.slice(0, limit)

  const scored: { emoji: Emoji; score: number }[] = []
  for (const emoji of EMOJI) {
    const name = emoji.name
    const score = name === needle
      ? 0
      : name.startsWith(needle)
        ? 1
        : name.includes(needle)
          ? 2
          : (emoji.keywords ?? '').split(' ').some((word) => word.startsWith(needle))
            ? 3
            : -1
    if (score >= 0) scored.push({ emoji, score })
  }

  // Stable within a score band: the list above is hand-ordered by how often
  // each one is actually wanted, and sorting must not throw that away.
  return scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.emoji)
}
