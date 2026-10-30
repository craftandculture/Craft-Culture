import countryFlag from '../utils/countryFlag';
import shipmentRouteStops, { type ShipmentRouteInput } from '../utils/shipmentRouteStops';

export interface ShipmentRouteProps {
  shipment: ShipmentRouteInput;
  /** Smaller type, for the dashboard's narrower column */
  compact?: boolean;
}

/**
 * A shipment's route as four stops on a line: solid where it has been, dashed
 * where it has still to go, and the arrival in red once it is overdue
 *
 * @example
 *   <ShipmentRoute shipment={shipment} />
 */
const ShipmentRoute = ({ shipment, compact }: ShipmentRouteProps) => {
  const stops = shipmentRouteStops(shipment);
  return (
    <ol className={`grid grid-cols-2 sm:grid-cols-4 ${compact ? 'gap-y-2' : 'gap-y-3'}`} aria-label="Route">
      {stops.map((stop, i) => {
        const nextDone = stops[i + 1]?.done ?? false;
        const flag = countryFlag(stop.country);
        return (
          <li key={stop.step} className={`flex min-w-0 flex-col pr-2.5 ${compact ? 'gap-1' : 'gap-1.5'}`}>
            {!compact && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{stop.step}</span>
            )}
            <span className="flex items-center" aria-hidden>
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  stop.late
                    ? 'border-2 border-red-600 bg-surface-primary'
                    : stop.done
                      ? 'bg-text-primary'
                      : 'border-2 border-border-muted bg-surface-primary'
                }`}
              />
              {i < stops.length - 1 && (
                <span
                  className={`h-0 flex-1 border-t-2 ${
                    nextDone ? 'border-solid border-text-primary' : 'border-dashed border-border-muted'
                  }`}
                />
              )}
            </span>
            <span className={`flex min-w-0 items-center gap-1.5 font-medium text-text-primary ${compact ? 'text-xs' : 'text-sm'}`}>
              {flag && <span className="shrink-0 leading-none">{flag}</span>}
              <span className="truncate" title={stop.place}>
                {stop.place}
              </span>
            </span>
            {stop.date && (
              <span
                className={`text-xs ${
                  stop.late ? 'font-semibold text-red-700 dark:text-red-400' : stop.done ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {stop.date}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default ShipmentRoute;
