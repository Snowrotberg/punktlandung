type HomeMapPosterProps = {
  ready?: boolean;
  sideAdsFilled?: boolean;
};

export function HomeMapPoster({ ready = false, sideAdsFilled = false }: HomeMapPosterProps) {
  const readyClass = ready ? " is-ready" : "";
  return (
    <div className="punktlandung-home-map-pictures" data-poster-layout={sideAdsFilled ? "ads" : "wide"} aria-hidden="true">
      <div className={`punktlandung-home-map-poster punktlandung-home-map-poster-wide${readyClass}`} />
      <div className={`punktlandung-home-map-poster punktlandung-home-map-poster-ads${readyClass}`} />
    </div>
  );
}
