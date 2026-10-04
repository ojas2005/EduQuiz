import re


def course_title(topic: str, proposed: str | None = None) -> str:
    """Use the generated summary, with a deterministic fallback for legacy paths."""
    if proposed:
        title = ' '.join(proposed.split()).strip('"\' .')
        if 3 <= len(title.split()) <= 5 and len(title) <= 80:
            return title
    known = {'sentences': 'Building Clear Sentences', 'paragraphs': 'Writing Focused Paragraphs'}
    if topic.strip().casefold() in known:
        return known[topic.strip().casefold()]
    subject = re.sub(r'^(?:(?:i\s+(?:want|would like)\s+to\s+)?learn(?:\s+about)?|teach\s+me|how\s+to)\s+', '', topic.strip(), flags=re.I)
    # Legacy outlines often start with a useful heading before their detailed syllabus.
    subject = re.split(r'[\n:;]|\s[-–—]\s|\b(?:including|covering|with|such as)\b', subject, maxsplit=1, flags=re.I)[0]
    words = re.findall(r"[\w]+(?:[+#./'-][\w+#./'-]*)?", subject)[:5]
    words = [word for word in words if len(word) <= 24]
    while len(' '.join(words)) > 65:
        words.pop()
    if not words:
        return 'Focused Learning Essentials'
    if len(words) == 1:
        words += ['Made', 'Clear']
    elif len(words) == 2:
        words += ['Essentials']
    return ' '.join(words)[0].upper() + ' '.join(words)[1:]
