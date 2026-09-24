#include <limits>
#include <cmath>
#include <bit>

template<class R, class F>
constexpr R saturating_cast(F x) noexcept {
  if (std::isnan(x)) {
    if consteval {
      return R(x); // Make the call not a constant expression.
    } else {
      // TODO: Emit domain error.
      //       On platforms like ARM where NaN gets converted to zero by static_cast,
      //       we could simply return R(x) here,
      //       but that also depends on whether R(NaN) is treated
      //       as an optimization opportunity (poison value) instead of being zero.
      return R(0);
    }
  }

  if constexpr (std::numeric_limits<R>::digits >= std::numeric_limits<F>::max_exponent) {
    if constexpr (std::is_signed_v<R>) {
      // Every truncated finite number is representable for signed R.
      // We only need to check for infinity.
      if (std::isinf(x)) {
        return x < F(0) ? std::numeric_limits<R>::lowest()
                        : std::numeric_limits<R>::max();
      }
    } else {
      // Every positive truncated finite number is representable for unsigned R.
      // We still need to check for negatives and infinity.
      //
      // In practice, this happens in e.g. float32_t → unsigned __int128,
      // where the subsequent static_cast is delegated to __fixunssfti.
      if (x < F(0)) {
        return R(0);
      }
      if (std::isinf(x)) {
        return std::numeric_limits<R>::max();
      }
    }
  } else if constexpr (std::is_signed_v<R>) {
    // Otherwise, we need to compute the bounds of the range (min, max)
    // (i.e. exclusive on both ends).
    // that does not cause casting to have undefined behavior.
    // Infinities also fall outside that range and need no explicit handling.

    // Since integers use two's complement,
    // this is one past the greatest integer,
    // so already the bound we are looking for.
    constexpr F max = -F(std::numeric_limits<R>::lowest());
    if (x >= max) {
      return std::numeric_limits<R>::max();
    }

    // We use lowest() because it is a power of two,
    // so there is no risk of rounding.
    // It can only overflow to infinity.
    constexpr F min = F(std::numeric_limits<R>::lowest());

    if constexpr (min - 1 < min) {
      // Numbers within 1 distance of lowest() get truncated to lowest(),
      // so lowest() is not the bound; the next lower integer is the bound.
      if (x <= min - 1) {
        return std::numeric_limits<R>::lowest();
      }
    } else if (x < min) {
      // In this case, there exists no integer directly below lowest()
      // due to limited floating-point precision.
      // This makes lowest() a genuine exclusive bound.
      return std::numeric_limits<R>::lowest();
    }
  } else {
    // We use bit_floor to get a power of two, avoiding rounding issues.
    // Multiplication by two then gets us one past the greatest integer.
    constexpr F max = F(std::bit_floor(std::numeric_limits<R>::max())) * 2;
    if (x >= max) {
      return std::numeric_limits<R>::max();
    }
    // Any negative value would make the truncated result unrepresentable.
    if (x < F(0)) {
      static_assert(std::numeric_limits<R>::lowest() == 0);
      return R(0);
    }
  }

  return R(x);
}
