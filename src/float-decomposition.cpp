struct f64_decomposition {
private:
  static constexpr int exponent_bits = 11;
  static constexpr int significand_bits = 52;
  static constexpr int exponent_offset = 1023 + significand_bits;
  static constexpr uint64_t integer_bit = 1ull << significand_bits;
  static constexpr uint64_t significand_mask = integer_bit - 1;

public:
  static constexpr int radix = 2;
  static constexpr int min_exponent = -1023 - significand_bits;
  static constexpr int max_exponent = 1024 - significand_bits;
  static constexpr int exponent_width = exponent_bits + 1;
  static constexpr uint64_t max_significand = (integer_bit << 1) - 1;
  static constexpr int significand_width = significand_bits + 1;
  using significand_type = uint64_t;

  uint64_t m;
  int e;
  bool s;

  constexpr int              sign() const noexcept { return s ? -1 : 1; }
  constexpr bool             sign_bit() const noexcept { return s; }
  constexpr int              exponent() const noexcept { return e; }
  constexpr significand_type significand() const noexcept { return m; }

  constexpr bool is_finite() const noexcept {
    return e != max_exponent;
  }
  constexpr bool is_inf() const noexcept {
    return e == max_exponent && m == 0;
  }
  constexpr bool is_nan() const noexcept {
    return e == max_exponent && m != 0;
  }
  constexpr bool is_normal() const noexcept {
    return e != max_exponent && e != min_exponent;
  }
  constexpr bool is_signaling() const noexcept {
    return e == max_exponent && m != 0 && (m & (integer_bit >> 1)) == 0;
  }
  constexpr bool is_subnormal() const noexcept {
    return e == min_exponent && m != 0;
  }
  constexpr bool is_zero() const noexcept {
    return e == min_exponent && m == 0;
  }

private:
  static constexpr f64_decomposition decompose(float64_t x) noexcept {
    constexpr int max_raw_exp = (1 << exponent_bits) - 1;

    auto xi = std::bit_cast<uint64_t>(x);
    int raw_exp = (xi >> significand_bits) & max_raw_exp;
    bool signbit = (xi >> (exponent_bits + significand_bits)) != 0;
    uint64_t raw_m = xi & significand_mask;

    if (raw_exp == 0) [[unlikely]] {
      // Subnormals are shifted to the left
      // to account for the missing integer bit compared to normals.
      // Without this shift, subnormals and zeroes
      // could not be identified by their exponent alone,
      // and recomposition would be more complicated.
      raw_m <<= 1;
    } else if (raw_exp != max_raw_exp) [[likely]] {
      // Normal numbers (but not infinity or NaN) have an implicit leading 1.
      raw_m |= integer_bit;
    }
    return { raw_m, raw_exp - exponent_offset, signbit };
  }

public:
  constexpr explicit operator float64_t() const noexcept {
    uint64_t raw_exp = e + exponent_offset;
    // Subnormal significands and zeroes have been shifted to the left above.
    uint64_t raw_m = m >> (e == min_exponent);
    uint64_t bits = (uint64_t{s} << (exponent_bits + significand_bits))
                  | (raw_exp << significand_bits)
                  | (raw_m & significand_mask);
    return std::bit_cast<float64_t>(bits);
  }

  friend constexpr f64_decomposition decompose_float(float64_t x);
};

constexpr f64_decomposition decompose_float(float64_t x) {
  return f64_decomposition::decompose(x);
}
