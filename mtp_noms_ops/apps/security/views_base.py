from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import Http404
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateformat import format as date_format
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from django.views.generic import FormView, TemplateView
from mtp_common.auth.api_client import get_api_session
from mtp_common.auth.exceptions import HttpNotFoundError
from requests.exceptions import RequestException

from security.export import ObjectListXlsxResponse
from security.tasks import email_export_xlsx


class SimpleSecurityDetailView(TemplateView):
    """
    Base view for showing a single templated page without a form
    """
    title = NotImplemented
    template_name = NotImplemented
    object_context_key = NotImplemented
    list_title = NotImplemented
    list_url = NotImplemented

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.object = None

    @cached_property
    def session(self):
        return get_api_session(self.request)

    def get_object_request_params(self):
        raise NotImplementedError

    def get_object(self):
        try:
            return self.session.get(**self.get_object_request_params()).json()
        except HttpNotFoundError:
            raise Http404('%s not found' % self.object_context_key)
        except (RequestException, ValueError):
            messages.error(self.request, _('This service is currently unavailable'))
            return {}

    def get_context_data(self, **kwargs):
        self.object = self.get_object()

        context_data = super().get_context_data(**kwargs)
        context_data[self.object_context_key] = self.object

        list_url = self.request.build_absolute_uri(str(self.list_url))
        referrer_url = self.request.META.get('HTTP_REFERER', '-')
        if referrer_url.split('?', 1)[0] == list_url:
            list_url = referrer_url

        context_data['breadcrumbs'] = [
            {'name': _('Home'), 'url': reverse('dashboard')},
            {'name': self.list_title, 'url': list_url},
            {'name': self.title}
        ]
        return context_data


class SecurityView(FormView):
    """
    Base view for retrieving security-related searches
    Allows form submission via GET, i.e. form is always bound
    """
    title = NotImplemented
    template_name = NotImplemented
    form_template_name = NotImplemented
    object_list_context_key = NotImplemented
    export_view = False
    export_redirect_view = None
    export_download_limit = settings.MAX_CREDITS_TO_DOWNLOAD

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.redirect_on_single = False

    def get_form_kwargs(self):
        form_kwargs = super().get_form_kwargs()
        form_kwargs['request'] = self.request
        request_data = self.get_initial()
        request_data.update(self.request.GET.dict())
        if 'redirect-on-single' in request_data:
            self.redirect_on_single = True
        form_kwargs['data'] = request_data
        return form_kwargs

    def form_valid(self, form):
        if self.export_view:
            attachment_name = 'exported-%s-%s.xlsx' % (
                self.object_list_context_key, date_format(timezone.now(), 'Y-m-d')
            )
            if self.export_view == 'email':
                email_export_xlsx(
                    object_type=self.object_list_context_key,
                    user=self.request.user,
                    session=self.request.session,
                    endpoint_path=form.get_object_list_endpoint_path(),
                    filters=form.get_query_data(),
                    export_description=self.get_export_description(form),
                    attachment_name=attachment_name,
                )
                messages.info(
                    self.request,
                    _('The spreadsheet will be emailed to you at %(email)s') % {'email': self.request.user.email}
                )
                return self.get_export_redirect(form)
            return ObjectListXlsxResponse(form.get_complete_object_list(),
                                          object_type=self.object_list_context_key,
                                          attachment_name=attachment_name)

        context = self.get_context_data(form=form)
        object_list = form.get_object_list()
        form.check_and_update_saved_searches(self.title)
        if self.redirect_on_single and len(object_list) == 1 and hasattr(self, 'url_for_single_result'):
            return redirect(self.url_for_single_result(object_list[0]))
        context[self.object_list_context_key] = object_list
        return render(self.request, self.template_name, context)

    def form_invalid(self, form):
        if self.export_view:
            return self.get_export_redirect(form)
        return super().form_invalid(form)

    def get_context_data(self, **kwargs):
        context_data = super().get_context_data(**kwargs)
        context_data['breadcrumbs'] = [
            {'name': _('Home'), 'url': reverse('dashboard')},
            {'name': self.title}
        ]
        return context_data

    def get_export_redirect(self, form):
        return redirect('%s?%s' % (reverse(self.export_redirect_view, kwargs=self.kwargs), form.query_string))

    def get_export_description(self, form):
        return str(form.search_description['description'])

    get = FormView.post


class SecurityDetailView(SecurityView):
    """
    Base view for presenting a profile with associated credits
    Allows form submission via GET
    """
    list_title = NotImplemented
    list_url = NotImplemented
    id_kwarg_name = NotImplemented
    object_list_context_key = 'credits'
    object_context_key = NotImplemented

    def get_form_kwargs(self):
        form_kwargs = super().get_form_kwargs()
        form_kwargs['object_id'] = self.kwargs[self.id_kwarg_name]
        return form_kwargs

    def get_context_data(self, **kwargs):
        context_data = super().get_context_data(**kwargs)

        detail_object = context_data['form'].get_object()
        if detail_object is None:
            raise Http404('Detail object not found')
        self.title = self.get_title_for_object(detail_object)
        list_url = self.request.build_absolute_uri(str(self.list_url))
        referrer_url = self.request.META.get('HTTP_REFERER', '-')
        if referrer_url.split('?', 1)[0] == list_url:
            list_url = referrer_url
        context_data[self.object_context_key] = detail_object

        context_data['breadcrumbs'] = [
            {'name': _('Home'), 'url': reverse('dashboard')},
            {'name': self.list_title, 'url': list_url},
            {'name': self.title}
        ]
        return context_data

    def get_title_for_object(self, detail_object):
        raise NotImplementedError

    def get_export_description(self, form):
        detail_object = form.get_object()
        title = self.get_title_for_object(detail_object)
        return '%s: %s' % (title, super().get_export_description(form))
