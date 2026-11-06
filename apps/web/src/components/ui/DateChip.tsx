export function DateChip({ day, month }: { day: string; month: string }) {
  return (
    <div className="date-chip">
      <span className="date-chip__day">{day}</span>
      <span className="date-chip__month">{month}</span>
    </div>
  );
}
