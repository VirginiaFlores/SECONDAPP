sap.ui.define([], function () {
	"use strict";
	return {

		/*
		 * Function to retrieve the correct text to dates.
		 * @param {object} idLM contains the value of LM id retrieve of backend.
		 */
		formatDate: function (rejectionDate) {

			if (!rejectionDate) {
				return "";
			}

			let dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd/MM/yyyy"
			});

			return dateFormat.format(new Date(rejectionDate));

		}
	};
});