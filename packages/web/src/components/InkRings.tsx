/** Hero art: the approved Bond mark, used as supplied (no redrawing or filters). It eases in, then floats gently. */
export function InkRings() {
  return (
    <img
      className="ink-rings"
      src={`${import.meta.env.BASE_URL}brand/bond-mark-light.svg`}
      alt="The Bond mark: two interlocked links"
      width={330}
      height={330}
    />
  );
}
