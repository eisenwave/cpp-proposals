const x_input = document.getElementById("x-input");
const y_input = document.getElementById("y-input");
const inputs = [x_input, y_input];

const quo_double = document.getElementById("quo-double");
const quo_trunc = document.getElementById("quo-trunc");
const quo_mag = document.getElementById("quo-mag");
const quo_floor = document.getElementById("quo-floor");
const quo_ceil = document.getElementById("quo-ceil");
const quo_ties_trunc = document.getElementById("quo-ties-trunc");
const quo_ties_mag = document.getElementById("quo-ties-mag");
const quo_ties_floor = document.getElementById("quo-ties-floor");
const quo_ties_ceil = document.getElementById("quo-ties-ceil");
const quo_ties_odd = document.getElementById("quo-ties-odd");
const quo_ties_even = document.getElementById("quo-ties-even");
const rem_trunc = document.getElementById("rem-trunc");
const rem_floor = document.getElementById("rem-floor");

const outputs = [
    quo_trunc, quo_mag, quo_floor, quo_ceil,
    quo_ties_trunc, quo_ties_mag, quo_ties_floor, quo_ties_ceil, quo_ties_odd, quo_ties_even,
    rem_trunc, rem_floor
];

for (const input of inputs) {
    input.addEventListener("input", compute_outputs);
}

function compute_outputs() {
    try {
        const x = BigInt(x_input.value);
        const y = BigInt(y_input.value);

        if (y === 0n) {
            on_error("DIVISION BY ZERO");
            return;
        } else {
            clear_errors();
        }

        const quotient_negative = (x >= 0) != (y >= 0);
        const quotient_sign = sgn(x) * sgn(y);

        const double = Number(x) / Number(y);
        const trunc = x / y;
        const mag = trunc + BigInt(x % y !== 0n) * quotient_sign;
        const floor = trunc - BigInt(x % y !== 0n && quotient_negative);
        const ceil = trunc + BigInt(x % y !== 0n && !quotient_negative);

        quo_double.innerText = String(double);
        quo_trunc.innerText = String(trunc);
        quo_mag.innerText = String(mag);
        quo_floor.innerText = String(floor);
        quo_ceil.innerText = String(ceil);

        const abs_rem2 = (2n * x % (2n * y)) * sgn(x);
        const abs_y = y * sgn(y);

        const ties_trunc = trunc + BigInt(x % y !== 0n && abs_rem2 > abs_y) * quotient_sign;
        const ties_mag = trunc + BigInt(x % y !== 0n && abs_rem2 >= abs_y) * quotient_sign;
        const ties_floor = trunc + BigInt(x % y !== 0n && abs_rem2 >= abs_y + BigInt(!quotient_negative)) * quotient_sign;
        const ties_ceil = trunc + BigInt(x % y !== 0n && abs_rem2 >= abs_y + BigInt(quotient_negative)) * quotient_sign;
        const ties_odd = trunc + BigInt(x % y !== 0n && abs_rem2 >= abs_y + BigInt(trunc % 2n === 0)) * quotient_sign;
        const ties_even = trunc + BigInt(x % y !== 0n && abs_rem2 >= abs_y + BigInt(trunc % 2n !== 0)) * quotient_sign;

        quo_ties_trunc.innerText = String(ties_trunc);
        quo_ties_mag.innerText = String(ties_mag);
        quo_ties_floor.innerText = String(ties_floor);
        quo_ties_ceil.innerText = String(ties_ceil);
        quo_ties_odd.innerText = String(ties_odd);
        quo_ties_even.innerText = String(ties_even);

        const r_trunc = x % y;
        const r_floor = x - floor * y;

        rem_trunc.innerText = String(r_trunc);
        rem_floor.innerText = String(r_floor);
    } catch (e) {
        on_error("SYNTAX ERROR");
    }
}

function sgn(x) {
    return BigInt(x > 0n) - BigInt(x < 0n);
}

function clear_errors() {
    for (const output of outputs) {
        output.parentElement.setAttribute("data-h", "num");
    }
}

function on_error(text) {
    for (const output of outputs) {
        output.textContent = text;
        output.parentElement.setAttribute("data-h", "err");
    }
}

compute_outputs();
