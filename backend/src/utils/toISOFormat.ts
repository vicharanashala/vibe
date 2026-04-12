export const getISTFormattedTimestamp = (): string => {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);

    const get = (type: string) =>
        parts.find(p => p.type === type)?.value ?? '';

    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    return `${day}/${month}/${year} - ${hour}:${minute}:${second}`;
};
